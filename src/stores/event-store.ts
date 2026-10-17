import { create } from 'zustand'
import type { CalendarEvent } from '@/types'
import * as storage from '@/lib/storage'
import { MAX_UNDO_HISTORY } from '@/lib/constants'
import { normalizeEvent } from '@/lib/normalize'
import { eventKey } from '@/lib/utils'
import { api } from '@/lib/cloud/api'
import { useAccountStore } from './account-store'

// One list for every visible event. Events without a calendarId live on this
// device (IndexedDB); events with one live in an account calendar on the server.
// Writes go to wherever the event lives. Events are identified by eventKey()
// (calendar + UID + RECURRENCE-ID): an overridden occurrence shares its master's UID.

interface EventState {
  events: CalendarEvent[]
  loaded: boolean
  past: CalendarEvent[][]
  future: CalendarEvent[][]
  /** Set when a write to the account failed; the UI shows it once. */
  syncError: string | null
  load: () => Promise<void>
  /** Replace the account events with the server's current state. */
  loadCloud: () => Promise<void>
  /** Resolves false when the write failed (the editor then stays open). */
  addEvent: (event: CalendarEvent) => Promise<boolean>
  updateEvent: (event: CalendarEvent) => Promise<boolean>
  deleteEvent: (key: string) => Promise<boolean>
  deleteEvents: (keys: string[]) => Promise<boolean>
  /** Import into this device. */
  importEvents: (events: CalendarEvent[]) => Promise<void>
  /** Clear this device's events (account calendars are untouched). */
  clearAll: () => Promise<void>
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
  canUndo: () => boolean
  canRedo: () => boolean
  clearSyncError: () => void
}

function pushHistory(past: CalendarEvent[][], snapshot: CalendarEvent[]): CalendarEvent[][] {
  const next = [...past, snapshot]
  if (next.length > MAX_UNDO_HISTORY) next.shift()
  return next
}

/**
 * Apply a history snapshot without rewinding SEQUENCE: subscribers (and re-imports)
 * treat a lower SEQUENCE as stale, so every event the snapshot changes gets a
 * sequence above both versions and a fresh revision time.
 */
function restoreSnapshot(snapshot: CalendarEvent[], current: CalendarEvent[]): CalendarEvent[] {
  const now = new Date().toISOString()
  const byKey = new Map(current.map((e) => [eventKey(e), e]))
  return snapshot.map((e) => {
    const cur = byKey.get(eventKey(e))
    if (!cur || JSON.stringify(cur) === JSON.stringify(e)) return e
    return { ...e, sequence: Math.max(e.sequence, cur.sequence) + 1, lastModified: now, dtstamp: now }
  })
}

const isCloud = (e: CalendarEvent) => !!e.calendarId

/** Order-independent fingerprint of the account events in a list. */
function cloudSignature(list: CalendarEvent[]): string {
  return JSON.stringify(
    list
      .filter(isCloud)
      .map((e) => [eventKey(e), e] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  )
}

async function save(event: CalendarEvent): Promise<CalendarEvent> {
  if (event.calendarId) return normalizeEvent(await api.putEvent(event.calendarId, event))
  await storage.putEvent(event)
  return event
}

async function remove(event: CalendarEvent): Promise<void> {
  if (event.calendarId) await api.deleteEvent(event.calendarId, event.uid, event.recurrenceId)
  else await storage.deleteEvent(event)
}

/** Deleting an account event's master removes its overrides too (as the server does). */
function withoutDeleted(events: CalendarEvent[], deleted: CalendarEvent[]): CalendarEvent[] {
  const keys = new Set(deleted.map(eventKey))
  const masters = new Set(deleted.filter((d) => d.calendarId && !d.recurrenceId).map((d) => `${d.calendarId}/${d.uid}`))
  return events.filter((e) => !keys.has(eventKey(e)) && !(e.calendarId && masters.has(`${e.calendarId}/${e.uid}`)))
}

/**
 * A history snapshot with its account part replaced by the server's current
 * account events. Undo and redo then restore only device events, and syncCloud
 * finds no account difference to write, so a step recorded before another member
 * or device changed the calendar cannot revert or delete their work.
 */
function rebase(snapshot: CalendarEvent[], cloud: CalendarEvent[]): CalendarEvent[] {
  return [...snapshot.filter((e) => !isCloud(e)), ...cloud]
}

/** Same device events, by identity (snapshots share the event objects they keep). */
function sameDevice(a: CalendarEvent[], b: CalendarEvent[]): boolean {
  const da = a.filter((e) => !isCloud(e))
  const db = new Set(b.filter((e) => !isCloud(e)))
  return da.length === db.size && da.every((e) => db.has(e))
}

/** Drop rebased history steps that would no longer change anything. */
function compact(history: CalendarEvent[][], current: CalendarEvent[]): CalendarEvent[][] {
  const out: CalendarEvent[][] = []
  let next = current
  for (let i = history.length - 1; i >= 0; i--) {
    const snap = history[i]!
    if (sameDevice(snap, next)) continue
    out.unshift(snap)
    next = snap
  }
  return out
}

/** Persist the difference between two states of the account events (undo/redo). */
async function syncCloud(from: CalendarEvent[], to: CalendarEvent[]): Promise<CalendarEvent[]> {
  const before = new Map(from.filter(isCloud).map((e) => [eventKey(e), e]))
  const after = new Map(to.filter(isCloud).map((e) => [eventKey(e), e]))
  for (const [key, e] of before) if (!after.has(key)) await remove(e)
  const saved: CalendarEvent[] = []
  for (const [key, e] of after) {
    const prev = before.get(key)
    saved.push(prev && JSON.stringify(prev) === JSON.stringify(e) ? e : await save(e))
  }
  return saved
}

export const useEventStore = create<EventState>((set, get) => {
  // Every action that reads the event list, awaits, and writes it back runs in
  // this queue, one at a time. A focus refresh that landed while a save was in
  // flight let the save push a snapshot taken before the refresh, and undoing it
  // then deleted or reverted other members' events on the server.
  let queue: Promise<unknown> = Promise.resolve()
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(fn, fn)
    queue = run.catch(() => {})
    return run
  }

  /** Run a write; on failure keep the device intact, reload the account events and resolve false. */
  function guarded(fn: () => Promise<void>): Promise<boolean> {
    return serial(async () => {
      try {
        await fn()
        return true
      } catch (err) {
        console.error('[events] save failed:', err)
        set({ syncError: err instanceof Error ? err.message : 'error' })
        // Already inside the queue, so the unqueued refresh (the queued one would wait on itself).
        await refreshCloud().catch(() => {})
        return false
      }
    })
  }

  async function refreshCloud(): Promise<void> {
    const { status, calendars, shared } = useAccountStore.getState()
    // A failed account check (offline, server restarting) says nothing about the
    // account events on screen. Dropping them unmounted an open editor and lost
    // its unsaved text, so they stay until the next check that succeeds.
    if (status === 'unavailable' || status === 'loading') return
    if (status !== 'signedIn') {
      if (!get().events.some(isCloud)) return
      const local = get().events.filter((e) => !isCloud(e))
      set({ events: local, past: compact(get().past.map((p) => rebase(p, [])), local), future: compact(get().future.map((f) => rebase(f, [])), local) })
      return
    }
    const lists = await Promise.all(calendars.map((c) => api.events(c.id)))
    const byKey = new Map<string, CalendarEvent>()
    for (const e of [...lists.flat(), ...shared.flatMap((s) => s.events)]) byKey.set(eventKey(e), normalizeEvent(e))
    const fresh = [...byKey.values()]
    if (cloudSignature(get().events) === cloudSignature(fresh)) return
    const events = [...get().events.filter((e) => !isCloud(e)), ...fresh]
    set({
      events,
      past: compact(get().past.map((p) => rebase(p, fresh)), events),
      future: compact(get().future.map((f) => rebase(f, fresh)), events),
    })
  }

  return {
    events: [],
    loaded: false,
    past: [],
    future: [],
    syncError: null,

    load: () =>
      serial(async () => {
        const local = await storage.getAllEvents()
        set({ events: [...local, ...get().events.filter(isCloud)], loaded: true })
      }),

    // Undo history is only valid against the account state it was recorded on.
    // When that state changes underneath it (another device or member, a
    // sign-out), each snapshot's account part is replaced by the new state
    // (rebase), so undo still restores device events but never replays old
    // account versions.
    loadCloud: () => serial(refreshCloud),

    addEvent: (input) =>
      guarded(async () => {
        const event = normalizeEvent(input)
        const saved = await save(event)
        const { events } = get()
        set({
          past: pushHistory(get().past, events),
          future: [],
          events: [...events.filter((e) => eventKey(e) !== eventKey(saved)), saved],
        })
      }),

    updateEvent: (input) =>
      guarded(async () => {
        const { events } = get()
        const key = eventKey(input)
        const previous = events.find((e) => eventKey(e) === key)
        const now = new Date().toISOString()
        // Bump SEQUENCE past the stored version, but keep a higher value the user typed.
        const updated = normalizeEvent({
          ...input,
          lastModified: now,
          dtstamp: now,
          sequence: Math.max(input.sequence, (previous?.sequence ?? -1) + 1),
        })
        const saved = await save(updated)
        set({
          past: pushHistory(get().past, events),
          future: [],
          events: get().events.map((e) => (eventKey(e) === key ? saved : e)),
        })
      }),

    deleteEvent: (key) => get().deleteEvents([key]),

    deleteEvents: (keys) =>
      guarded(async () => {
        const { events } = get()
        const keySet = new Set(keys)
        const doomed = events.filter((e) => keySet.has(eventKey(e)))
        // Server first: if it fails, nothing on the device has changed yet.
        for (const e of doomed.filter(isCloud)) await remove(e)
        const local = doomed.filter((e) => !isCloud(e))
        if (local.length) await storage.deleteEvents(local)
        set({ past: pushHistory(get().past, events), future: [], events: withoutDeleted(get().events, doomed) })
      }),

    importEvents: (input) =>
      serial(async () => {
        const { events } = get()
        const incoming = input.map((e) => normalizeEvent({ ...e, calendarId: undefined }))
        set({ past: pushHistory(get().past, events), future: [] })
        await storage.putEvents(incoming)
        const incomingByKey = new Map(incoming.map((e) => [eventKey(e), e]))
        const existingKeys = new Set(events.map(eventKey))
        const updatedEvents = events.map((e) => incomingByKey.get(eventKey(e)) ?? e)
        const newEvents = incoming.filter((e) => !existingKeys.has(eventKey(e)))
        set({ events: [...updatedEvents, ...newEvents] })
      }),

    clearAll: () =>
      serial(async () => {
        const { events } = get()
        set({ past: pushHistory(get().past, events), future: [] })
        await storage.clearAllEvents()
        set({ events: events.filter(isCloud) })
      }),

    undo: () =>
      guarded(async () => {
        const { past, events } = get()
        if (past.length === 0) return
        const previous = restoreSnapshot(past[past.length - 1]!, events)
        // Server first, device second: a failed server write leaves IndexedDB and
        // the screen as they were instead of half-applied.
        const cloud = await syncCloud(events, previous)
        await storage.replaceAllEvents(previous.filter((e) => !isCloud(e)))
        set({
          past: past.slice(0, -1),
          future: [...get().future, events],
          events: [...previous.filter((e) => !isCloud(e)), ...cloud],
        })
      }),

    redo: () =>
      guarded(async () => {
        const { future, events } = get()
        if (future.length === 0) return
        const next = restoreSnapshot(future[future.length - 1]!, events)
        const cloud = await syncCloud(events, next)
        await storage.replaceAllEvents(next.filter((e) => !isCloud(e)))
        set({
          future: future.slice(0, -1),
          past: [...get().past, events],
          events: [...next.filter((e) => !isCloud(e)), ...cloud],
        })
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
    clearSyncError: () => set({ syncError: null }),
  }
})
