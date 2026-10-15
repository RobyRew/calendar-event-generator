import { create } from 'zustand'
import type { CalendarEvent } from '@/types'
import * as storage from '@/lib/storage'
import { MAX_UNDO_HISTORY } from '@/lib/constants'
import { normalizeEvent } from '@/lib/normalize'
import { eventKey } from '@/lib/utils'

// Events are identified by eventKey() (UID + RECURRENCE-ID), not the UID alone:
// an overridden occurrence shares its master's UID.

interface EventState {
  events: CalendarEvent[]
  loaded: boolean
  past: CalendarEvent[][]
  future: CalendarEvent[][]
  load: () => Promise<void>
  addEvent: (event: CalendarEvent) => Promise<void>
  updateEvent: (event: CalendarEvent) => Promise<void>
  deleteEvent: (key: string) => Promise<void>
  deleteEvents: (keys: string[]) => Promise<void>
  importEvents: (events: CalendarEvent[]) => Promise<void>
  clearAll: () => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
  canUndo: () => boolean
  canRedo: () => boolean
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

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loaded: false,
  past: [],
  future: [],

  load: async () => {
    const events = await storage.getAllEvents()
    set({ events, loaded: true })
  },

  addEvent: async (input) => {
    const { events } = get()
    const event = normalizeEvent(input)
    set({ past: pushHistory(get().past, events), future: [] })
    await storage.putEvent(event)
    set({ events: [...events.filter((e) => eventKey(e) !== eventKey(event)), event] })
  },

  updateEvent: async (input) => {
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
    set({ past: pushHistory(get().past, events), future: [] })
    await storage.putEvent(updated)
    set({ events: events.map((e) => (eventKey(e) === key ? updated : e)) })
  },

  deleteEvent: async (key) => {
    const { events } = get()
    set({ past: pushHistory(get().past, events), future: [] })
    await storage.deleteEvent(key)
    set({ events: events.filter((e) => eventKey(e) !== key) })
  },

  deleteEvents: async (keys) => {
    const { events } = get()
    set({ past: pushHistory(get().past, events), future: [] })
    await storage.deleteEvents(keys)
    const keySet = new Set(keys)
    set({ events: events.filter((e) => !keySet.has(eventKey(e))) })
  },

  importEvents: async (input) => {
    const { events } = get()
    const incoming = input.map((e) => normalizeEvent(e))
    set({ past: pushHistory(get().past, events), future: [] })
    await storage.putEvents(incoming)
    const incomingByKey = new Map(incoming.map((e) => [eventKey(e), e]))
    const existingKeys = new Set(events.map(eventKey))
    const updatedEvents = events.map((e) => incomingByKey.get(eventKey(e)) ?? e)
    const newEvents = incoming.filter((e) => !existingKeys.has(eventKey(e)))
    set({ events: [...updatedEvents, ...newEvents] })
  },

  clearAll: async () => {
    const { events } = get()
    set({ past: pushHistory(get().past, events), future: [] })
    await storage.clearAllEvents()
    set({ events: [] })
  },

  undo: async () => {
    const { past, events } = get()
    if (past.length === 0) return
    const previous = restoreSnapshot(past[past.length - 1]!, events)
    set({
      past: past.slice(0, -1),
      future: [...get().future, events],
      events: previous,
    })
    await storage.replaceAllEvents(previous)
  },

  redo: async () => {
    const { future, events } = get()
    if (future.length === 0) return
    const next = restoreSnapshot(future[future.length - 1]!, events)
    set({
      future: future.slice(0, -1),
      past: [...get().past, events],
      events: next,
    })
    await storage.replaceAllEvents(next)
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}))
