import { create } from 'zustand'
import type { CalendarEvent } from '@/types'
import * as storage from '@/lib/storage'
import { MAX_UNDO_HISTORY } from '@/lib/constants'
import { normalizeEvent } from '@/lib/normalize'
import { eventKey, generateUID } from '@/lib/utils'
import { api } from '@/lib/cloud/api'
import { canEditCalendar, useAccountStore } from './account-store'

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
  /** Import into an account calendar (sent in batches through the import API). */
  importToCalendar: (calendarId: string, events: CalendarEvent[]) => Promise<boolean>
  /**
   * Move whole events (master and overrides) to an account calendar, or (null) to
   * this device, keeping their UIDs. The source must be this device or a calendar
   * the user may write to.
   */
  moveEvents: (keys: string[], target: string | null) => Promise<boolean>
  /** Copy whole events under new UIDs to an account calendar or (null) this device. */
  copyEvents: (keys: string[], target: string | null) => Promise<boolean>
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
 *
 * The exception is a step that moved events between this device and the account
 * (`next` is the state after the step): for those UIDs the snapshot keeps its own
 * account part, so undoing the move restores both halves. Replacing it as well
 * made undo of an account-to-device move delete the event, and undo of a
 * device-to-account move leave it in both places.
 */
function rebase(snapshot: CalendarEvent[], cloud: CalendarEvent[], next: CalendarEvent[], later: Set<string> = new Set()): CalendarEvent[] {
  const deviceUids = (list: CalendarEvent[]) => new Set(list.filter((e) => !isCloud(e)).map((e) => e.uid))
  /** UID → the account calendars holding it. */
  const homes = (list: CalendarEvent[]) => {
    const out = new Map<string, Set<string>>()
    for (const e of list) if (isCloud(e)) out.set(e.uid, (out.get(e.uid) ?? new Set()).add(e.calendarId!))
    return out
  }
  const was = deviceUids(snapshot)
  const now = deviceUids(next)
  const homesBefore = homes(snapshot)
  const homesAfter = homes(next)
  // The calendars where a UID appeared or disappeared in this step.
  const changedHomes = (u: string) => {
    const a = homesBefore.get(u) ?? new Set<string>()
    const b = homesAfter.get(u) ?? new Set<string>()
    return [...new Set([...a, ...b])].filter((c) => a.has(c) !== b.has(c))
  }
  // A move changes where a UID lives on both sides. A device-only change (deleting
  // or importing a device copy of a UID that also exists in the account) is not a
  // move and does not pin the account's old version. Only the calendars the move
  // touched are pinned; another calendar holding the same UID follows the server.
  const pinned = new Set<string>()
  for (const u of new Set([...was, ...now])) {
    if (was.has(u) === now.has(u)) continue
    for (const c of changedHomes(u)) pinned.add(`${c}/${u}`)
    // Where the user's own later steps took this UID (moving it on from the
    // calendar this step put it in) is part of what undoing this step reverts.
    for (const e of cloud) if (e.uid === u && later.has(`${e.calendarId}/${u}`)) pinned.add(`${e.calendarId}/${u}`)
  }
  const pin = (e: CalendarEvent) => pinned.has(`${e.calendarId}/${e.uid}`)
  return [
    ...snapshot.filter((e) => !isCloud(e)),
    ...cloud.filter((e) => !pin(e)),
    ...snapshot.filter((e) => isCloud(e) && pin(e)),
  ]
}

/**
 * Rebase a history list from its newest step to its oldest: each step takes its
 * account part from the (rebased) step after it, the newest from the server. Each
 * step's moves are found against the step that originally followed it. Rebasing
 * every step against the server independently gave a step older than a move the
 * post-move account state, so undoing past the move deleted the moved event or
 * left it in two places.
 */
function rebaseAll(history: CalendarEvent[][], cloud: CalendarEvent[], current: CalendarEvent[]): CalendarEvent[][] {
  const home = (e: CalendarEvent) => `${e.calendarId}/${e.uid}`
  const out: CalendarEvent[][] = []
  // Calendar/UID places that the user's own steps after the one being rebased created.
  const later = new Set<string>()
  let base = cloud
  for (let i = history.length - 1; i >= 0; i--) {
    const next = history[i + 1] ?? current
    const snap = rebase(history[i]!, base, next, later)
    out.unshift(snap)
    base = snap.filter(isCloud)
    const had = new Set(history[i]!.filter(isCloud).map(home))
    for (const e of next) if (isCloud(e) && !had.has(home(e))) later.add(home(e))
  }
  return out
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

/**
 * Delete account events. Whole events in calendars the user can write to go in one
 * request per calendar (one per event ran into the API rate limit when undoing a
 * large move); an override whose master goes too is skipped, as the server removes
 * it with the master; the rest (single shared events, lone overrides) one by one.
 */
async function removeCloud(list: CalendarEvent[], keptSeries: Set<string> = new Set()): Promise<void> {
  const series = (e: CalendarEvent) => `${e.calendarId}/${e.uid}`
  const masters = new Set(list.filter((e) => !e.recurrenceId).map(series))
  const bulk = new Map<string, string[]>()
  const bulkMasters = new Map<string, string[]>()
  for (const e of list) {
    const keep = keptSeries.has(series(e))
    // An override goes with its master, unless the series keeps other parts (then
    // only the master row is deleted and the override is deleted on its own).
    if (e.recurrenceId && masters.has(series(e)) && !keep) continue
    if (!e.recurrenceId && keep) {
      if (canEditCalendar(e.calendarId)) bulkMasters.set(e.calendarId!, [...(bulkMasters.get(e.calendarId!) ?? []), e.uid])
      else await api.deleteEvent(e.calendarId!, e.uid, '', true)
    } else if (!e.recurrenceId && canEditCalendar(e.calendarId)) bulk.set(e.calendarId!, [...(bulk.get(e.calendarId!) ?? []), e.uid])
    else await remove(e)
  }
  for (const [calendarId, uids] of bulk) {
    for (let i = 0; i < uids.length; i += 1000) await api.deleteEvents(calendarId, uids.slice(i, i + 1000))
  }
  for (const [calendarId, uids] of bulkMasters) {
    for (let i = 0; i < uids.length; i += 1000) await api.deleteEvents(calendarId, uids.slice(i, i + 1000), true)
  }
}

/** Persist the difference between two states of the account events (undo/redo), in as few requests as possible. */
async function syncCloud(from: CalendarEvent[], to: CalendarEvent[]): Promise<CalendarEvent[]> {
  const before = new Map(from.filter(isCloud).map((e) => [eventKey(e), e]))
  const after = new Map(to.filter(isCloud).map((e) => [eventKey(e), e]))
  const series = (e: CalendarEvent) => `${e.calendarId}/${e.uid}`
  const gone = [...before].filter(([k]) => !after.has(k)).map(([, e]) => e)
  // Writes first, deletions last: undoing an account-to-account move used to
  // delete the event from one calendar before writing it back to the other, so a
  // failed write left it in neither. A master whose series keeps other parts (an
  // override without its master) is deleted alone, so the parts written here stay.
  const kept = new Set([...after.values()].map(series))
  const savedByKey = new Map<string, CalendarEvent>()
  const bulk = new Map<string, CalendarEvent[]>()
  for (const [key, e] of after) {
    const prev = before.get(key)
    if (prev && JSON.stringify(prev) === JSON.stringify(e)) continue
    if (canEditCalendar(e.calendarId)) bulk.set(e.calendarId!, [...(bulk.get(e.calendarId!) ?? []), e])
    else savedByKey.set(key, await save(e))
  }
  for (const [calendarId, list] of bulk) {
    for (const batch of importBatches(list.map((e) => normalizeEvent({ ...e, calendarId: undefined })))) {
      for (const s of await api.importEvents(calendarId, batch)) {
        const saved = normalizeEvent(s)
        savedByKey.set(eventKey(saved), saved)
      }
    }
  }
  await removeCloud(gone, kept)
  return [...after].map(([key, e]) => savedByKey.get(key) ?? e)
}

// Requests to the import API stay well under its limits (5,000 events, 8 MiB).
const BATCH_EVENTS = 1000
const BATCH_BYTES = 6 * 1024 * 1024
const encoder = new TextEncoder()

/** Split events into import requests, keeping each series (one UID) in a single request. */
export function importBatches(list: CalendarEvent[]): CalendarEvent[][] {
  const series = new Map<string, CalendarEvent[]>()
  for (const e of list) series.set(e.uid, [...(series.get(e.uid) ?? []), e])
  const out: CalendarEvent[][] = []
  let current: CalendarEvent[] = []
  let bytes = 0
  for (const group of series.values()) {
    const size = group.reduce((n, e) => n + encoder.encode(JSON.stringify(e)).length + 1, 0)
    if (current.length && (current.length + group.length > BATCH_EVENTS || bytes + size > BATCH_BYTES)) {
      out.push(current)
      current = []
      bytes = 0
    }
    current.push(...group)
    bytes += size
  }
  if (current.length) out.push(current)
  return out
}

/** The selected events with every other part of their series, grouped by where they live ('' = this device). */
function seriesBySource(all: CalendarEvent[], keys: string[]): Map<string, CalendarEvent[]> {
  const wanted = new Set(all.filter((e) => keys.includes(eventKey(e))).map((e) => `${e.calendarId ?? ''}\u0000${e.uid}`))
  const out = new Map<string, CalendarEvent[]>()
  for (const e of all) {
    if (!wanted.has(`${e.calendarId ?? ''}\u0000${e.uid}`)) continue
    const source = e.calendarId ?? ''
    out.set(source, [...(out.get(source) ?? []), e])
  }
  return out
}

const withoutCalendar = (e: CalendarEvent): CalendarEvent => normalizeEvent({ ...e, calendarId: undefined })

/** `list` with `incoming` added, each replacing an event with the same key (never two entries per key). */
function replaceByKey(list: CalendarEvent[], incoming: CalendarEvent[]): CalendarEvent[] {
  const keys = new Set(incoming.map(eventKey))
  return [...list.filter((e) => !keys.has(eventKey(e))), ...incoming]
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

  /**
   * Bring the device and the account from `from` to `to` (undo/redo). Device events
   * that `to` adds are written first; the account second (its writes before its
   * deletions, see syncCloud); device deletions and changes last. A failed step
   * then leaves an event in two places rather than in none (undoing a
   * device-to-account move used to delete the account copies before the device
   * ones were back); on failure the screen's device events are reloaded from
   * IndexedDB, so the two agree.
   */
  async function applyState(from: CalendarEvent[], to: CalendarEvent[]): Promise<CalendarEvent[]> {
    const toDevice = to.filter((e) => !isCloud(e))
    const fromKeys = new Set(from.filter((e) => !isCloud(e)).map(eventKey))
    const added = toDevice.filter((e) => !fromKeys.has(eventKey(e)))
    if (added.length) await storage.putEvents(added)
    let cloud: CalendarEvent[]
    try {
      cloud = await syncCloud(from, to)
    } catch (err) {
      if (added.length) {
        const device = await storage.getAllEvents()
        set({ events: [...device, ...get().events.filter(isCloud)] })
      }
      throw err
    }
    await storage.replaceAllEvents(toDevice)
    return cloud
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
      set({ events: local, past: compact(rebaseAll(get().past, [], local), local), future: compact(rebaseAll(get().future, [], local), local) })
      return
    }
    const lists = await Promise.all(calendars.map((c) => api.events(c.id)))
    const byKey = new Map<string, CalendarEvent>()
    for (const e of [...lists.flat(), ...shared.flatMap((s) => s.events)]) byKey.set(eventKey(e), normalizeEvent(e))
    const fresh = [...byKey.values()]
    if (cloudSignature(get().events) === cloudSignature(fresh)) return
    const events = [...get().events.filter((e) => !isCloud(e)), ...fresh]
    const current = get().events
    set({
      events,
      past: compact(rebaseAll(get().past, fresh, current), events),
      future: compact(rebaseAll(get().future, fresh, current), events),
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
        await removeCloud(doomed.filter(isCloud))
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

    importToCalendar: (calendarId, input) =>
      guarded(async () => {
        const before = get().events
        let current = before
        try {
          for (const batch of importBatches(input.map(withoutCalendar))) {
            const saved = (await api.importEvents(calendarId, batch)).map(normalizeEvent)
            current = replaceByKey(current, saved)
            set({ events: current })
          }
        } finally {
          // Batches already written get their undo step even when a later one fails.
          if (current !== before) set({ past: pushHistory(get().past, before), future: [], events: current })
        }
      }),

    moveEvents: (keys, target) =>
      guarded(async () => {
        const before = get().events
        let current = before
        try {
          for (const [source, list] of seriesBySource(before, keys)) {
            const from = source || null
            if (from === target) continue
            if (!canEditCalendar(from ?? undefined)) throw new Error('read_only')
            const uids = [...new Set(list.map((e) => e.uid))]
            // A move never replaces an event that is already where it is going:
            // the import would have overwritten the account's version (and edits
            // others made to it) with the device copy, and the device write the
            // device's own event. 409-style refusal instead, nothing moved.
            const there = (e: CalendarEvent) => (e.calendarId ?? null) === target && uids.includes(e.uid)
            // Checked against the running state: an earlier source of this same move
            // may already have put an event with this UID there.
            if (current.some(there)) throw new Error('uid_exists')
            const fromSource = (e: CalendarEvent, ids: string[]) => (e.calendarId ?? null) === from && ids.includes(e.uid)
            if (!from && target) {
              // Device → account: each batch is written to the account first (create-only,
              // so the server refuses a UID it already has), then removed from the device.
              for (const batch of importBatches(list)) {
                const saved = (await api.importEvents(target, batch.map(withoutCalendar), true)).map(normalizeEvent)
                await storage.deleteEvents(batch)
                const ids = [...new Set(batch.map((e) => e.uid))]
                current = replaceByKey(current.filter((e) => !fromSource(e, ids)), saved)
                set({ events: current })
              }
            } else if (from && target) {
              for (let i = 0; i < uids.length; i += 500) {
                const ids = uids.slice(i, i + 500)
                const moved = (await api.moveEvents(from, ids, target)).map(normalizeEvent)
                current = replaceByKey(current.filter((e) => !fromSource(e, ids)), moved)
                set({ events: current })
              }
            } else if (from && !target) {
              // Account → device, up to 1,000 events per step: copy to the device,
              // then delete them on the server in one request; if that fails, the
              // device copies of that step are removed again.
              for (let i = 0; i < uids.length; i += 1000) {
                const ids = uids.slice(i, i + 1000)
                const local = list.filter((e) => ids.includes(e.uid)).map(withoutCalendar)
                await storage.putEvents(local)
                try {
                  await api.deleteEvents(from, ids)
                } catch (err) {
                  await storage.deleteEvents(local)
                  throw err
                }
                current = replaceByKey(current.filter((e) => !fromSource(e, ids)), local)
                set({ events: current })
              }
            }
          }
        } finally {
          if (current !== before) set({ past: pushHistory(get().past, before), future: [], events: current })
        }
      }),

    copyEvents: (keys, target) =>
      guarded(async () => {
        const before = get().events
        const now = new Date().toISOString()
        const copies: CalendarEvent[] = []
        for (const list of seriesBySource(before, keys).values()) {
          const uids = new Map<string, string>()
          for (const e of list) {
            if (!uids.has(e.uid)) uids.set(e.uid, generateUID())
            copies.push(normalizeEvent({ ...e, uid: uids.get(e.uid)!, calendarId: undefined, sequence: 0, created: now, lastModified: now, dtstamp: now }))
          }
        }
        let current = before
        try {
          if (target) {
            for (const batch of importBatches(copies)) {
              current = replaceByKey(current, (await api.importEvents(target, batch, true)).map(normalizeEvent))
              set({ events: current })
            }
          } else {
            await storage.putEvents(copies)
            current = replaceByKey(current, copies)
          }
        } finally {
          if (current !== before) set({ past: pushHistory(get().past, before), future: [], events: current })
        }
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
        const cloud = await applyState(events, previous)
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
        const cloud = await applyState(events, next)
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
