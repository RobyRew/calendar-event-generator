import type { CalendarEvent, EventAlarm, RecurrenceRule } from '@/types'
import { createDefaultEvent } from './utils'
import { toHexColor } from './colors'
import {
  addDaysIn, formatDuration, isUTCZone, isValidISO, parseDuration, parseICSDateValue,
  resolveZone, startOfDayIn, UTC_ZONE,
} from './time'

const ABSOLUTE_TRIGGER = /^\d{8}T\d{6}Z$/i

/**
 * Bring any event — fresh from the editor, parsed from ICS, restored from JSON, or
 * loaded from IndexedDB in an older shape — into the invariants the generator and
 * the server rely on. One place, so every entry point gets the same repairs:
 *   - missing fields filled from defaults (JSON imports used to crash the generator)
 *   - all-day: midnight in the event zone, end exclusive and ≥ start + 1 day
 *     (editor/template all-day events used to end on their start date)
 *   - RRULE: COUNT and UNTIL never both set (UNTIL wins)
 *   - alarm triggers canonical (`-PT1D` from the old reminder picker → `-P1D`)
 *   - legacy raw RECURRENCE-ID / ACKNOWLEDGED strings converted to instants
 */
export function normalizeEvent(input: Partial<CalendarEvent>): CalendarEvent {
  const defined = Object.fromEntries(
    Object.entries(input ?? {}).filter(([, v]) => v !== undefined),
  ) as Partial<CalendarEvent>
  const e = createDefaultEvent(defined)

  e.uid = String(e.uid || createDefaultEvent().uid)
  e.timezone = isUTCZone(e.timezone) ? UTC_ZONE : resolveZone(e.timezone)
  const tz = e.timezone

  for (const key of ['summary', 'description', 'comment', 'url', 'relatedTo', 'contact', 'templateId', 'sourceFile', 'sourceCalendar', 'recurrenceId'] as const) {
    if (typeof e[key] !== 'string') e[key] = e[key] == null ? '' : String(e[key])
  }
  for (const key of ['categories', 'resources'] as const) {
    e[key] = Array.isArray(e[key]) ? e[key].filter((v): v is string => typeof v === 'string' && v.length > 0) : []
  }
  e.attendees = Array.isArray(e.attendees) ? e.attendees.filter((a) => a && typeof a === 'object') : []
  e.attachments = Array.isArray(e.attachments) ? e.attachments.filter((a) => a && typeof a.uri === 'string' && a.uri) : []
  e.apple = e.apple && typeof e.apple === 'object' ? e.apple : {}
  e.google = e.google && typeof e.google === 'object' ? e.google : {}
  e.microsoft = e.microsoft && typeof e.microsoft === 'object' ? e.microsoft : {}

  e.sequence = Number.isFinite(e.sequence) && e.sequence > 0 ? Math.floor(e.sequence) : 0
  e.priority = Number.isFinite(e.priority) ? Math.min(9, Math.max(0, Math.floor(e.priority))) : 0
  if (e.color) e.color = toHexColor(e.color) ?? ''
  for (const key of ['created', 'lastModified', 'dtstamp'] as const) {
    if (e[key] && !isValidISO(e[key])) e[key] = ''
  }

  // Times. An input without an end is zero-length (RFC 5545), not "now + default duration".
  if (!isValidISO(e.startDate)) e.startDate = new Date().toISOString()
  if (!isValidISO(defined.endDate) || !isValidISO(e.endDate)) e.endDate = e.startDate
  if (e.allDay) {
    e.startDate = startOfDayIn(e.startDate, tz)
    e.endDate = startOfDayIn(e.endDate, tz)
    if (new Date(e.endDate) <= new Date(e.startDate)) e.endDate = addDaysIn(e.startDate, 1, tz)
  } else if (new Date(e.endDate) < new Date(e.startDate)) {
    e.endDate = e.startDate
  }

  // Recurrence
  e.recurrenceRule = normalizeRule(e.recurrenceRule)
  e.recurrenceExceptions = (Array.isArray(e.recurrenceExceptions) ? e.recurrenceExceptions : [])
    .map((x) => legacyInstant(x, tz))
    .filter((x): x is string => !!x)
  if (e.recurrenceDates) {
    e.recurrenceDates = e.recurrenceDates.map((x) => legacyInstant(x, tz)).filter((x): x is string => !!x)
  }
  e.recurrenceId = e.recurrenceId ? legacyInstant(e.recurrenceId, tz) ?? '' : ''

  // People
  if (e.organizer && !e.organizer.email?.trim() && !e.organizer.name?.trim()) e.organizer = null

  e.alarms = (Array.isArray(e.alarms) ? e.alarms : []).map(normalizeAlarm).filter((a): a is EventAlarm => !!a)

  return e
}

function normalizeRule(rule: RecurrenceRule | null | undefined): RecurrenceRule | null {
  if (!rule || typeof rule !== 'object' || !rule.frequency) return null
  const r: RecurrenceRule = { ...rule }
  r.interval = Number.isFinite(r.interval) && r.interval >= 1 ? Math.floor(r.interval) : 1
  if (r.until && !isValidISO(r.until)) delete r.until
  if (r.count !== undefined && (!Number.isFinite(r.count) || r.count < 1)) delete r.count
  // RFC 5545 §3.3.10: COUNT and UNTIL MUST NOT occur in the same rule.
  if (r.until && r.count !== undefined) delete r.count
  return r
}

function normalizeAlarm(a: EventAlarm): EventAlarm | null {
  if (!a || typeof a !== 'object') return null
  const alarm: EventAlarm = { ...a }
  alarm.action = (['DISPLAY', 'EMAIL', 'AUDIO'] as const).includes(alarm.action) ? alarm.action : 'DISPLAY'
  alarm.triggerRelation = alarm.triggerRelation === 'END' ? 'END' : 'START'
  const trig = String(alarm.trigger ?? '').trim()
  if (ABSOLUTE_TRIGGER.test(trig)) {
    alarm.trigger = trig.toUpperCase()
  } else {
    const seconds = parseDuration(trig)
    alarm.trigger = formatDuration(seconds ?? -15 * 60)
  }
  if (alarm.acknowledged) {
    const ack = legacyInstant(alarm.acknowledged, UTC_ZONE)
    if (ack) alarm.acknowledged = ack
    else delete alarm.acknowledged
  }
  if (alarm.duration) {
    const d = parseDuration(alarm.duration)
    if (d === null) delete alarm.duration
    else alarm.duration = formatDuration(Math.abs(d))
  }
  alarm.description = typeof alarm.description === 'string' ? alarm.description : ''
  alarm.isDefault = !!alarm.isDefault
  return alarm
}

/** An ISO instant, or a raw ICS DATE/DATE-TIME string stored by older versions. */
function legacyInstant(value: string, tz: string): string | null {
  if (typeof value !== 'string' || !value) return null
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && isValidISO(value)) return new Date(value).toISOString()
  const parsed = parseICSDateValue(value, { zone: tz })
  return parsed?.iso ?? null
}
