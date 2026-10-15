import Dexie, { type Table } from 'dexie'
import type { CalendarEvent, EventTemplate, AppSettings } from '@/types'
import { DB_NAME, DEFAULT_SETTINGS, STORAGE_KEYS } from './constants'
import { DEFAULT_TEMPLATES } from './default-templates'
import { normalizeEvent } from './normalize'

type EventPK = [uid: string, recurrenceId: string]

class CalendarDB extends Dexie {
  localEvents!: Table<CalendarEvent, EventPK>
  templates!: Table<EventTemplate, string>

  constructor() {
    super(DB_NAME)
    this.version(1).stores({
      events: 'uid, summary, startDate, *categories',
      templates: 'id, name, isBuiltIn, *categories',
    })
    // v2: a recurring master and its overridden occurrences share one UID (RFC 5545),
    // so keying rows by UID alone made an override silently replace its master.
    // Dexie cannot change a primary key in place, so rows move to a new table.
    this.version(2)
      .stores({ localEvents: '[uid+recurrenceId], uid, startDate, *categories' })
      .upgrade(async (tx) => {
        const old = (await tx.table('events').toArray()) as CalendarEvent[]
        await tx.table('localEvents').bulkPut(old.map((e) => normalizeEvent(e)))
      })
    this.version(3).stores({ events: null })
  }
}

export const db = new CalendarDB()

/** Inverse of `eventKey()` in utils. */
export function parseEventKey(key: string): EventPK {
  const i = key.indexOf('::')
  return i === -1 ? [key, ''] : [key.slice(0, i), key.slice(i + 2)]
}

export async function getAllEvents(): Promise<CalendarEvent[]> {
  // Normalising on load repairs rows written by older versions (e.g. `-PT1D`
  // triggers, all-day events whose end equalled their start).
  return (await db.localEvents.toArray()).map((e) => normalizeEvent(e))
}

export async function getEvent(key: string): Promise<CalendarEvent | undefined> {
  return db.localEvents.get(parseEventKey(key))
}

export async function putEvent(event: CalendarEvent): Promise<void> {
  await db.localEvents.put({ ...event, recurrenceId: event.recurrenceId || '' })
}

export async function putEvents(events: CalendarEvent[]): Promise<void> {
  await db.localEvents.bulkPut(events.map((e) => ({ ...e, recurrenceId: e.recurrenceId || '' })))
}

export async function deleteEvent(key: string): Promise<void> {
  await db.localEvents.delete(parseEventKey(key))
}

export async function deleteEvents(keys: string[]): Promise<void> {
  await db.localEvents.bulkDelete(keys.map(parseEventKey))
}

export async function clearAllEvents(): Promise<void> {
  await db.localEvents.clear()
}

/** Replace every stored event atomically (undo/redo used to clear then refill outside a transaction). */
export async function replaceAllEvents(events: CalendarEvent[]): Promise<void> {
  await db.transaction('rw', db.localEvents, async () => {
    await db.localEvents.clear()
    if (events.length > 0) await putEvents(events)
  })
}

export async function getEventCount(): Promise<number> {
  return db.localEvents.count()
}

export async function getAllTemplates(): Promise<EventTemplate[]> {
  return db.templates.toArray()
}

export async function putTemplate(template: EventTemplate): Promise<void> {
  await db.templates.put(template)
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.templates.delete(id)
}

export async function clearCustomTemplates(): Promise<void> {
  // IndexedDB cannot index booleans, so `where('isBuiltIn').equals(0)` matched nothing.
  await db.templates.filter((t) => !t.isBuiltIn).delete()
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings))
  } catch { /* storage unavailable (private mode) */ }
}

const SEED_KEY = 'calgen_templates_seeded'

/** Delete all events, templates and settings; built-in templates are re-seeded on next load. */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.localEvents, db.templates, async () => {
    await db.localEvents.clear()
    await db.templates.clear()
  })
  try {
    localStorage.removeItem(STORAGE_KEYS.settings)
    localStorage.removeItem(SEED_KEY)
  } catch { /* storage unavailable */ }
}

/** Backup as a JSON string — write it to the file as-is (do not stringify again). */
export async function exportAllData(): Promise<string> {
  const events = await getAllEvents()
  const templates = await getAllTemplates()
  const settings = loadSettings()
  return JSON.stringify({ version: 2, events, templates, settings }, null, 2)
}

export async function importAllData(json: string): Promise<{ events: number; templates: number }> {
  let data: unknown = JSON.parse(json)
  // Backups written before this fix were stringified twice; unwrap them.
  if (typeof data === 'string') data = JSON.parse(data)
  const obj = (data ?? {}) as { events?: unknown; templates?: unknown; settings?: unknown }
  const events = Array.isArray(obj.events) ? (obj.events as Partial<CalendarEvent>[]).map((e) => normalizeEvent(e)) : []
  const templates = Array.isArray(obj.templates) ? (obj.templates as EventTemplate[]) : []
  if (events.length > 0) await putEvents(events)
  if (templates.length > 0) await db.templates.bulkPut(templates)
  if (obj.settings && typeof obj.settings === 'object') saveSettings({ ...DEFAULT_SETTINGS, ...(obj.settings as Partial<AppSettings>) })
  return { events: events.length, templates: templates.length }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate()
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
  }
  return { usage: 0, quota: 0 }
}

export async function seedDefaultTemplates(): Promise<void> {
  try {
    if (localStorage.getItem(SEED_KEY)) return
  } catch { /* storage unavailable: seed if the table is empty */ }
  const existing = await db.templates.count()
  if (existing === 0) {
    await db.templates.bulkPut(DEFAULT_TEMPLATES)
  }
  try {
    localStorage.setItem(SEED_KEY, '1')
  } catch { /* storage unavailable */ }
}
