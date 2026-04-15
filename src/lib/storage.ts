import Dexie, { type Table } from 'dexie'
import type { CalendarEvent, EventTemplate, AppSettings } from '@/types'
import { DB_NAME, DB_VERSION, DEFAULT_SETTINGS, STORAGE_KEYS } from './constants'
import { DEFAULT_TEMPLATES } from './default-templates'

class CalendarDB extends Dexie {
  events!: Table<CalendarEvent, string>
  templates!: Table<EventTemplate, string>

  constructor() {
    super(DB_NAME)
    this.version(DB_VERSION).stores({
      events: 'uid, summary, startDate, *categories',
      templates: 'id, name, isBuiltIn, *categories',
    })
  }
}

export const db = new CalendarDB()

export async function getAllEvents(): Promise<CalendarEvent[]> {
  return db.events.toArray()
}

export async function getEvent(uid: string): Promise<CalendarEvent | undefined> {
  return db.events.get(uid)
}

export async function putEvent(event: CalendarEvent): Promise<void> {
  await db.events.put(event)
}

export async function putEvents(events: CalendarEvent[]): Promise<void> {
  await db.events.bulkPut(events)
}

export async function deleteEvent(uid: string): Promise<void> {
  await db.events.delete(uid)
}

export async function deleteEvents(uids: string[]): Promise<void> {
  await db.events.bulkDelete(uids)
}

export async function clearAllEvents(): Promise<void> {
  await db.events.clear()
}

export async function getEventCount(): Promise<number> {
  return db.events.count()
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
  await db.templates.where('isBuiltIn').equals(0).delete()
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
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings))
}

export function clearAllData(): void {
  db.events.clear()
  db.templates.clear()
  localStorage.removeItem(STORAGE_KEYS.settings)
}

export async function exportAllData(): Promise<string> {
  const events = await getAllEvents()
  const templates = await getAllTemplates()
  const settings = loadSettings()
  return JSON.stringify({ version: 2, events, templates, settings }, null, 2)
}

export async function importAllData(json: string): Promise<{ events: number; templates: number }> {
  const data = JSON.parse(json)
  const events: CalendarEvent[] = data.events ?? []
  const templates: EventTemplate[] = data.templates ?? []
  if (events.length > 0) await putEvents(events)
  if (templates.length > 0) await db.templates.bulkPut(templates)
  if (data.settings) saveSettings({ ...DEFAULT_SETTINGS, ...data.settings })
  return { events: events.length, templates: templates.length }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate()
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
  }
  return { usage: 0, quota: 0 }
}

const SEED_KEY = 'calgen_templates_seeded'

export async function seedDefaultTemplates(): Promise<void> {
  if (localStorage.getItem(SEED_KEY)) return
  const existing = await db.templates.count()
  if (existing === 0) {
    await db.templates.bulkPut(DEFAULT_TEMPLATES)
  }
  localStorage.setItem(SEED_KEY, '1')
}
