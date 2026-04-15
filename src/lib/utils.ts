import { v4 as uuidv4 } from 'uuid'
import { format, parseISO, addMinutes } from 'date-fns'
import type { CalendarEvent, DateFormat, TimeFormat } from '@/types'
import { DEFAULT_SETTINGS } from './constants'

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

export function parseTriggerDuration(trigger: string): number {
  const neg = trigger.startsWith('-')
  const match = trigger.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const days = parseInt(match[1] || '0', 10)
  const hours = parseInt(match[2] || '0', 10)
  const mins = parseInt(match[3] || '0', 10)
  const total = days * 1440 + hours * 60 + mins
  return neg ? total : -total
}

export function minutesToTrigger(minutes: number): string {
  if (minutes <= 0) return 'PT0M'
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  let result = '-P'
  if (d > 0) result += `${d}D`
  if (h > 0 || m > 0) {
    result += 'T'
    if (h > 0) result += `${h}H`
    if (m > 0) result += `${m}M`
  }
  return result
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
