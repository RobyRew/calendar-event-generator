import { create } from 'zustand'
import type { CalendarEvent } from '@/types'
import * as storage from '@/lib/storage'
import { MAX_UNDO_HISTORY } from '@/lib/constants'

interface EventState {
  events: CalendarEvent[]
  loaded: boolean
  past: CalendarEvent[][]
  future: CalendarEvent[][]
  load: () => Promise<void>
  addEvent: (event: CalendarEvent) => Promise<void>
  updateEvent: (event: CalendarEvent) => Promise<void>
  deleteEvent: (uid: string) => Promise<void>
  deleteEvents: (uids: string[]) => Promise<void>
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

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loaded: false,
  past: [],
  future: [],

  load: async () => {
    const events = await storage.getAllEvents()
    set({ events, loaded: true })
  },

  addEvent: async (event) => {
    const { events } = get()
    set({ past: pushHistory(get().past, events), future: [] })
    await storage.putEvent(event)
    set({ events: [...events, event] })
  },

  updateEvent: async (event) => {
    const { events } = get()
    set({ past: pushHistory(get().past, events), future: [] })
    const updated = { ...event, lastModified: new Date().toISOString(), sequence: event.sequence + 1 }
    await storage.putEvent(updated)
    set({ events: events.map((e) => (e.uid === updated.uid ? updated : e)) })
  },

  deleteEvent: async (uid) => {
    const { events } = get()
    set({ past: pushHistory(get().past, events), future: [] })
    await storage.deleteEvent(uid)
    set({ events: events.filter((e) => e.uid !== uid) })
  },

  deleteEvents: async (uids) => {
    const { events } = get()
    set({ past: pushHistory(get().past, events), future: [] })
    await storage.deleteEvents(uids)
    const uidSet = new Set(uids)
    set({ events: events.filter((e) => !uidSet.has(e.uid)) })
  },

  importEvents: async (incoming) => {
    const { events } = get()
    set({ past: pushHistory(get().past, events), future: [] })
    await storage.putEvents(incoming)
    const existingUids = new Set(events.map((e) => e.uid))
    const newEvents = incoming.filter((e) => !existingUids.has(e.uid))
    const updatedEvents = events.map((existing) => {
      const replacement = incoming.find((e) => e.uid === existing.uid)
      return replacement ?? existing
    })
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
    const previous = past[past.length - 1]!
    set({
      past: past.slice(0, -1),
      future: [...get().future, events],
      events: previous,
    })
    await storage.clearAllEvents()
    if (previous.length > 0) await storage.putEvents(previous)
  },

  redo: async () => {
    const { future, events } = get()
    if (future.length === 0) return
    const next = future[future.length - 1]!
    set({
      future: future.slice(0, -1),
      past: [...get().past, events],
      events: next,
    })
    await storage.clearAllEvents()
    if (next.length > 0) await storage.putEvents(next)
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}))
