import type { CalendarEvent, EventAlarm, EventAttendee, EventAttachment, RecurrenceRule, ByDay, WeekDay } from '@/types'
import { createDefaultEvent } from './utils'
import { toHexColor } from './colors'
import {
  addDaysIn, formatDuration, isUTCZone, isValidISO, parseDuration, parseICSDateValue,
  resolveZone, startOfDayIn, UTC_ZONE,
} from './time'

const ABSOLUTE_TRIGGER = /^\d{8}T\d{6}Z$/i

// Enumerated values are written into ICS lines as they are, so only listed values
// survive normalisation. An event-level editor could otherwise store
// "TENTATIVE\r\nBEGIN:VEVENT…" through the API and add events to every feed.
const STATUSES = ['TENTATIVE', 'CONFIRMED', 'CANCELLED'] as const
const CLASSES = ['PUBLIC', 'PRIVATE', 'CONFIDENTIAL'] as const
const TRANSPS = ['OPAQUE', 'TRANSPARENT'] as const
const FREQS = ['SECONDLY', 'MINUTELY', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
const ROLES = ['CHAIR', 'REQ-PARTICIPANT', 'OPT-PARTICIPANT', 'NON-PARTICIPANT'] as const
const PARTSTATS = ['NEEDS-ACTION', 'ACCEPTED', 'DECLINED', 'TENTATIVE', 'DELEGATED'] as const
const CUTYPES = ['INDIVIDUAL', 'GROUP', 'RESOURCE', 'ROOM', 'UNKNOWN'] as const
const TRAVEL = ['AUTOMATIC', 'DISABLED', 'ENABLED'] as const
const BYDAY = /^[+-]?\d{0,2}(SU|MO|TU|WE|TH|FR|SA)$/

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

const ints = (v: unknown): number[] | undefined =>
  Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : undefined

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
  e.attendees = Array.isArray(e.attendees) ? e.attendees.filter((a) => a && typeof a === 'object').map(normalizeAttendee) : []
  e.attachments = Array.isArray(e.attachments)
    ? e.attachments.filter((a) => a && typeof a.uri === 'string' && a.uri).map(normalizeAttachment)
    : []
  e.status = oneOf(e.status, STATUSES, 'CONFIRMED')
  e.classification = oneOf(e.classification, CLASSES, 'PUBLIC')
  e.transparency = oneOf(e.transparency, TRANSPS, 'OPAQUE')
  e.apple = e.apple && typeof e.apple === 'object' ? { ...e.apple } : {}
  if (e.apple.travelAdvisory !== undefined) {
    // Stored JSON can hold any type here; a non-string used to throw on toUpperCase.
    const raw: unknown = e.apple.travelAdvisory
    const t = oneOf(raw, TRAVEL, 'AUTOMATIC')
    if (typeof raw === 'string' && t === raw.trim().toUpperCase()) e.apple.travelAdvisory = t
    else delete e.apple.travelAdvisory
  }
  if (e.location && typeof e.location === 'object' && e.location.appleRadius !== undefined && !Number.isFinite(Number(e.location.appleRadius))) {
    e.location = { ...e.location }
    delete e.location.appleRadius
  }
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

function normalizeAttendee(a: EventAttendee): EventAttendee {
  return {
    ...a,
    name: typeof a.name === 'string' ? a.name : '',
    email: typeof a.email === 'string' ? a.email : '',
    role: oneOf(a.role, ROLES, 'REQ-PARTICIPANT'),
    status: oneOf(a.status, PARTSTATS, 'NEEDS-ACTION'),
    type: oneOf(a.type, CUTYPES, 'INDIVIDUAL'),
    rsvp: !!a.rsvp,
  }
}

function normalizeAttachment(a: EventAttachment): EventAttachment {
  const out: EventAttachment = { ...a }
  if (out.size !== undefined && !(Number.isInteger(out.size) && out.size >= 0)) delete out.size
  return out
}

function normalizeRule(rule: RecurrenceRule | null | undefined): RecurrenceRule | null {
  if (!rule || typeof rule !== 'object') return null
  const freq = typeof rule.frequency === 'string' ? rule.frequency.trim().toUpperCase() : ''
  if (!(FREQS as readonly string[]).includes(freq)) return null
  const r: RecurrenceRule = { ...rule, frequency: freq as RecurrenceRule['frequency'] }
  if (r.byDay !== undefined) {
    r.byDay = Array.isArray(r.byDay) ? r.byDay.map((d) => String(d).trim().toUpperCase()).filter((d) => BYDAY.test(d)) as ByDay[] : undefined
    if (!r.byDay?.length) delete r.byDay
  }
  if (r.weekStart !== undefined) {
    const w = String(r.weekStart).trim().toUpperCase()
    if ((WEEKDAYS as readonly string[]).includes(w)) r.weekStart = w as WeekDay
    else delete r.weekStart
  }
  for (const key of ['byMonthDay', 'byMonth', 'bySetPos', 'byYearDay', 'byWeekNo', 'byHour', 'byMinute', 'bySecond'] as const) {
    if (r[key] === undefined) continue
    const v = ints(r[key])
    if (v?.length) r[key] = v
    else delete r[key]
  }
  r.interval = Number.isFinite(r.interval) && r.interval >= 1 ? Math.floor(r.interval) : 1
  if (r.until && !isValidISO(r.until)) delete r.until
  if (r.count !== undefined && (!Number.isFinite(r.count) || r.count < 1)) delete r.count
  // RFC 5545 §3.3.10: COUNT and UNTIL MUST NOT occur in the same rule.
  if (r.until && r.count !== undefined) delete r.count
  return r
}

function normalizeAlarm(a: EventAlarm): EventAlarm | null {
  if (!a || typeof a !== 'object') return null
  // ACTION:NONE (RFC 9074; Apple's "no alert") is a placeholder, not an alert.
  // Coercing it to DISPLAY turned "no alert" into a real reminder on export.
  if (String(a.action ?? '').trim().toUpperCase() === 'NONE') return null
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
  if (alarm.repeat !== undefined && !(Number.isInteger(alarm.repeat) && alarm.repeat >= 0)) delete alarm.repeat
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
