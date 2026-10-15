import { v4 as uuidv4 } from 'uuid'
import { format, parseISO, addMinutes } from 'date-fns'
import type { CalendarEvent, DateFormat, TimeFormat } from '@/types'
import { DEFAULT_SETTINGS } from './constants'
import { formatDuration as formatRfcDuration, parseDuration, toWall } from './time'

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function generateUID(): string {
  return uuidv4().toUpperCase()
}

export function createDefaultEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0)
  const endDate = addMinutes(startDate, DEFAULT_SETTINGS.defaultDuration)

  return {
    uid: generateUID(),
    sequence: 0,
    summary: '',
    description: '',
    comment: '',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    allDay: false,
    timezone: DEFAULT_SETTINGS.defaultTimezone,
    status: DEFAULT_SETTINGS.defaultEventStatus,
    classification: DEFAULT_SETTINGS.defaultClassification,
    transparency: 'OPAQUE',
    location: null,
    organizer: null,
    attendees: [],
    recurrenceRule: null,
    recurrenceExceptions: [],
    recurrenceId: '',
    alarms: [],
    categories: [],
    color: DEFAULT_SETTINGS.defaultCalendarColor,
    priority: 0,
    url: '',
    attachments: [],
    relatedTo: '',
    resources: [],
    contact: '',
    created: now.toISOString(),
    lastModified: now.toISOString(),
    dtstamp: now.toISOString(),
    apple: {},
    google: {},
    microsoft: {},
    templateId: '',
    sourceFile: '',
    sourceCalendar: '',
    ...overrides,
  }
}

export function formatDate(iso: string, fmt: DateFormat): string {
  const date = parseISO(iso)
  switch (fmt) {
    case 'DD/MM/YYYY': return format(date, 'dd/MM/yyyy')
    case 'MM/DD/YYYY': return format(date, 'MM/dd/yyyy')
    case 'YYYY-MM-DD': return format(date, 'yyyy-MM-dd')
  }
}

export function formatTime(iso: string, tf: TimeFormat): string {
  const date = parseISO(iso)
  return tf === '24h' ? format(date, 'HH:mm') : format(date, 'hh:mm a')
}

export function formatDateTime(iso: string, df: DateFormat, tf: TimeFormat): string {
  return `${formatDate(iso, df)} ${formatTime(iso, tf)}`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/** Minutes before the event (positive = before) for an alarm trigger; 0 when absolute or invalid. */
export function parseTriggerDuration(trigger: string): number {
  const seconds = parseDuration(trigger)
  return seconds === null ? 0 : Math.round(-seconds / 60)
}

/** RFC 5545 trigger for "N minutes before": days go before the `T` (`-P1D`, not `-PT1D`). */
export function minutesToTrigger(minutes: number): string {
  if (minutes <= 0) return 'PT0S'
  return formatRfcDuration(-minutes * 60)
}

/**
 * Identity of an event row. A recurring master and its overridden occurrences share
 * a UID (RFC 5545), so the UID alone used to make an override overwrite its master.
 */
export function eventKey(event: Pick<CalendarEvent, 'uid' | 'recurrenceId'>): string {
  return event.recurrenceId ? `${event.uid}::${event.recurrenceId}` : event.uid
}

/**
 * The moment views place an event at. All-day events are a date in their own zone,
 * so they map to local midnight of that date — reading the stored instant in the
 * browser's zone put a Bucharest all-day event on the previous day in Madrid.
 */
export function eventDisplayStart(event: Pick<CalendarEvent, 'startDate' | 'allDay' | 'timezone'>): Date {
  if (!event.allDay) return new Date(event.startDate)
  const w = toWall(event.startDate, event.timezone)
  return new Date(w.year, w.month - 1, w.day)
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
