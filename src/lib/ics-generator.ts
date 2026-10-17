import type { CalendarEvent, CalendarMeta, EventAlarm, RecurrenceRule } from '@/types'
import { APP_NAME, PROD_ID } from './constants'
import { toCssColorName, toHexColor } from './colors'
import { includeAtLevel, redactEvent, type RedactLevel } from './redact'
import {
  formatDuration, formatICSDate, formatICSUTC, formatICSWall, isUTCZone, isValidISO,
  isValidTimeZone, parseDuration,
} from './time'
import { vtimezoneLinesFor } from './vtimezone'

// Pure module: no DOM, no storage, no host-timezone reads. The server builds its
// subscription feeds with this exact code (import it directly, not via '@/lib').

export interface GeneratorOptions {
  includeAppleExtensions?: boolean
  includeGoogleExtensions?: boolean
  includeMicrosoftExtensions?: boolean
  /** Shorthand for `redactLevel: 'no-personal'` (the export setting). */
  stripPersonalData?: boolean
  /** Field redaction applied to every event; overrides `stripPersonalData`. */
  redactLevel?: RedactLevel
  /** Title for busy-level events. */
  busyLabel?: string
  /** Leave out VALARMs (subscription feeds: subscribers set their own alerts). */
  stripAlarms?: boolean
  /** Only PUBLISH is ever written — a subscribed calendar must never carry REQUEST. */
  method?: 'PUBLISH'
  /** NAME / X-WR-CALNAME. Defaults to the app name; `null` leaves it out. */
  calendarName?: string | null
  /** DESCRIPTION / X-WR-CALDESC. */
  calendarDescription?: string
  /** X-WR-TIMEZONE (IANA). */
  calendarTimezone?: string
  /** Calendar colour (hex or CSS name): COLOR + X-APPLE-CALENDAR-COLOR. */
  calendarColor?: string
  /** REFRESH-INTERVAL / X-PUBLISHED-TTL as an RFC 5545 duration, e.g. 'PT1H'. */
  refreshInterval?: string
  /** SOURCE (RFC 7986): where the calendar can be re-fetched. */
  sourceUrl?: string
  /** DTSTAMP fallback for events that have no revision time (defaults to now). */
  now?: string
}

// ── Value encoding ──────────────────────────────────────────────────────────

/** Fold to 75 octets per line; continuation lines start with one space (RFC 5545 §3.1). */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const decoder = new TextDecoder()
  const parts: string[] = []
  let start = 0
  let isFirst = true
  while (start < bytes.length) {
    const chunkSize = isFirst ? 75 : 74
    let end = Math.min(start + chunkSize, bytes.length)
    if (end < bytes.length) {
      // Never split inside a UTF-8 sequence.
      while (end > start && (bytes[end]! & 0xc0) === 0x80) end--
    }
    const chunk = decoder.decode(bytes.slice(start, end))
    parts.push(isFirst ? chunk : ' ' + chunk)
    start = end
    isFirst = false
  }
  return parts.join('\r\n')
}

/** TEXT value (RFC 5545 §3.3.11). Backslash first, then the other escapes. */
export function escapeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Non-TEXT values (URI, UID, X-*) cannot carry line breaks. */
function plain(value: string): string {
  return value.replace(/[\r\n]+/g, ' ')
}

/** Parameter value per RFC 6868 (^^, ^n, ^'); quoted when it has to be or `forceQuote`. */
export function paramValue(value: string, forceQuote = false): string {
  const enc = value.replace(/\^/g, '^^').replace(/\r\n?|\n/g, '^n').replace(/"/g, "^'")
  return forceQuote || /[;:,]/.test(enc) ? `"${enc}"` : enc
}

// ── Dates ───────────────────────────────────────────────────────────────────

type TimeContext = Pick<CalendarEvent, 'allDay' | 'timezone'>

function isZoned(ctx: TimeContext): boolean {
  return !ctx.allDay && !isUTCZone(ctx.timezone) && isValidTimeZone(ctx.timezone)
}

/** DTSTART/DTEND/EXDATE/RDATE/RECURRENCE-ID in the same value type as the event. */
function dateProperty(name: string, iso: string, ctx: TimeContext): string {
  if (ctx.allDay) return `${name};VALUE=DATE:${formatICSDate(iso, ctx.timezone)}`
  if (!isZoned(ctx)) return `${name}:${formatICSUTC(iso)}`
  return `${name};TZID=${paramValue(ctx.timezone)}:${formatICSWall(iso, ctx.timezone)}`
}

export function buildRRule(rule: RecurrenceRule, ctx: TimeContext): string {
  const parts: string[] = [`FREQ=${rule.frequency}`]
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`)
  // RFC 5545 §3.3.10: UNTIL has DTSTART's value type (DATE for all-day, UTC
  // DATE-TIME otherwise), and COUNT/UNTIL are mutually exclusive.
  if (rule.until && isValidISO(rule.until)) {
    parts.push(`UNTIL=${ctx.allDay ? formatICSDate(rule.until, ctx.timezone) : formatICSUTC(rule.until)}`)
  } else if (rule.count !== undefined) {
    parts.push(`COUNT=${rule.count}`)
  }
  const list = (key: string, values?: (string | number)[]) => {
    if (values?.length) parts.push(`${key}=${values.join(',')}`)
  }
  list('BYSECOND', rule.bySecond)
  list('BYMINUTE', rule.byMinute)
  list('BYHOUR', rule.byHour)
  list('BYDAY', rule.byDay)
  list('BYMONTHDAY', rule.byMonthDay)
  list('BYYEARDAY', rule.byYearDay)
  list('BYWEEKNO', rule.byWeekNo)
  list('BYMONTH', rule.byMonth)
  list('BYSETPOS', rule.bySetPos)
  if (rule.weekStart) parts.push(`WKST=${rule.weekStart}`)
  return parts.join(';')
}

// ── Components ──────────────────────────────────────────────────────────────

function triggerLine(alarm: EventAlarm): string {
  if (/^\d{8}T\d{6}Z$/i.test(alarm.trigger)) return `TRIGGER;VALUE=DATE-TIME:${alarm.trigger.toUpperCase()}`
  const value = formatDuration(parseDuration(alarm.trigger) ?? -15 * 60)
  return alarm.triggerRelation === 'END' ? `TRIGGER;RELATED=END:${value}` : `TRIGGER:${value}`
}

function emitAlarm(emit: (l: string) => void, alarm: EventAlarm, event: CalendarEvent, apple: boolean) {
  // EMAIL alarms need SUMMARY, DESCRIPTION and at least one ATTENDEE (RFC 5545
  // §3.6.6). Without an address to send to, fall back to an on-screen alert.
  const recipient = event.organizer?.email?.trim()
  const action = alarm.action === 'EMAIL' && !recipient ? 'DISPLAY' : alarm.action
  const text = alarm.description?.trim() || event.summary || 'Reminder'

  emit('BEGIN:VALARM')
  if (alarm.uid) emit(`UID:${plain(alarm.uid)}`)
  emit(`ACTION:${action}`)
  emit(triggerLine(alarm))
  if (action === 'DISPLAY') {
    emit(`DESCRIPTION:${escapeText(text)}`)
  } else if (action === 'EMAIL') {
    emit(`SUMMARY:${escapeText(alarm.summary?.trim() || event.summary || 'Reminder')}`)
    emit(`DESCRIPTION:${escapeText(text)}`)
    emit(`ATTENDEE:mailto:${plain(recipient!)}`)
  } else if (action === 'AUDIO' && alarm.attachUri) {
    emit(`ATTACH;VALUE=URI:${plain(alarm.attachUri)}`)
  }
  // DURATION and REPEAT must appear together or not at all.
  const dur = alarm.duration ? parseDuration(alarm.duration) : null
  if (alarm.repeat && alarm.repeat > 0 && dur) {
    emit(`DURATION:${formatDuration(Math.abs(dur))}`)
    emit(`REPEAT:${alarm.repeat}`)
  }
  if (alarm.acknowledged && isValidISO(alarm.acknowledged)) emit(`ACKNOWLEDGED:${formatICSUTC(alarm.acknowledged)}`)
  if (apple) {
    if (alarm.isDefault) emit('X-APPLE-DEFAULT-ALARM:TRUE')
    if (alarm.uid) emit(`X-WR-ALARMUID:${plain(alarm.uid)}`)
  }
  emit('END:VALARM')
}

function emitEvent(
  emit: (l: string) => void,
  event: CalendarEvent,
  opts: Required<Pick<GeneratorOptions, 'includeAppleExtensions' | 'includeGoogleExtensions' | 'includeMicrosoftExtensions' | 'stripAlarms'>> & { now: string },
  masterTime?: TimeContext,
) {
  const ctx: TimeContext = { allDay: event.allDay, timezone: event.timezone }
  emit('BEGIN:VEVENT')
  emit(`UID:${plain(event.uid)}`)
  const stamp = [event.lastModified, event.dtstamp, opts.now].find(isValidISO)!
  emit(`DTSTAMP:${formatICSUTC(stamp)}`)
  emit(dateProperty('DTSTART', event.startDate, ctx))
  emit(dateProperty('DTEND', event.endDate, ctx))
  if (event.recurrenceId && isValidISO(event.recurrenceId)) emit(dateProperty('RECURRENCE-ID', event.recurrenceId, masterTime ?? ctx))

  emit(`SUMMARY:${escapeText(event.summary)}`)
  if (event.description) emit(`DESCRIPTION:${escapeText(event.description)}`)
  if (event.comment) emit(`COMMENT:${escapeText(event.comment)}`)
  if (isValidISO(event.created)) emit(`CREATED:${formatICSUTC(event.created)}`)
  if (isValidISO(event.lastModified)) emit(`LAST-MODIFIED:${formatICSUTC(event.lastModified)}`)
  if (event.sequence > 0) emit(`SEQUENCE:${event.sequence}`)
  if (event.status !== 'CONFIRMED') emit(`STATUS:${event.status}`)
  if (event.classification !== 'PUBLIC') emit(`CLASS:${event.classification}`)
  emit(`TRANSP:${event.transparency}`)

  if (event.url) emit(`URL;VALUE=URI:${plain(event.url)}`)
  if (event.priority > 0) emit(`PRIORITY:${event.priority}`)
  if (event.categories.length > 0) emit(`CATEGORIES:${event.categories.map(escapeText).join(',')}`)
  if (event.color) {
    const name = toCssColorName(event.color)
    if (name) emit(`COLOR:${name}`)
  }
  if (event.contact) emit(`CONTACT:${escapeText(event.contact)}`)
  if (event.relatedTo) emit(`RELATED-TO:${plain(event.relatedTo)}`)
  if (event.resources.length > 0) emit(`RESOURCES:${event.resources.map(escapeText).join(',')}`)

  if (event.location) {
    if (event.location.text) emit(`LOCATION:${escapeText(event.location.text)}`)
    const geo = event.location.geo
    if (geo && Number.isFinite(geo.latitude) && Number.isFinite(geo.longitude)) {
      emit(`GEO:${geo.latitude};${geo.longitude}`)
      // Apple needs a geo: URI as the value; without coordinates the property is invalid.
      if (opts.includeAppleExtensions) {
        const parts = ['VALUE=URI']
        if (event.location.appleAddress) parts.push(`X-ADDRESS=${paramValue(event.location.appleAddress, true)}`)
        if (event.location.appleMapItemHandle) parts.push(`X-APPLE-MAPKIT-HANDLE=${event.location.appleMapItemHandle.replace(/\s/g, '')}`)
        if (event.location.appleRadius) parts.push(`X-APPLE-RADIUS=${event.location.appleRadius}`)
        parts.push('X-APPLE-REFERENCEFRAME=1')
        const title = event.location.appleTitle || event.location.text
        if (title) parts.push(`X-TITLE=${paramValue(title, true)}`)
        emit(`X-APPLE-STRUCTURED-LOCATION;${parts.join(';')}:geo:${geo.latitude},${geo.longitude}`)
      }
    }
  }

  const organizerEmail = event.organizer?.email?.trim()
  if (event.organizer && organizerEmail) {
    const parts: string[] = []
    if (event.organizer.name?.trim()) parts.push(`CN=${paramValue(event.organizer.name.trim(), true)}`)
    if (event.organizer.sentBy) parts.push(`SENT-BY=${paramValue(`mailto:${event.organizer.sentBy}`, true)}`)
    emit(`ORGANIZER${parts.length ? ';' + parts.join(';') : ''}:mailto:${plain(organizerEmail)}`)
  }
  for (const att of event.attendees) {
    const email = att.email?.trim()
    if (!email) continue // an ATTENDEE value must be a calendar address
    const parts: string[] = []
    if (att.name?.trim()) parts.push(`CN=${paramValue(att.name.trim(), true)}`)
    parts.push(`CUTYPE=${paramValue(att.type || 'INDIVIDUAL')}`)
    parts.push(`PARTSTAT=${paramValue(att.status || 'NEEDS-ACTION')}`)
    parts.push(`ROLE=${paramValue(att.role || 'REQ-PARTICIPANT')}`)
    if (att.rsvp) parts.push('RSVP=TRUE')
    if (att.delegatedFrom) parts.push(`DELEGATED-FROM=${paramValue(withMailto(att.delegatedFrom), true)}`)
    if (att.delegatedTo) parts.push(`DELEGATED-TO=${paramValue(withMailto(att.delegatedTo), true)}`)
    emit(`ATTENDEE;${parts.join(';')}:mailto:${plain(email)}`)
  }

  if (event.recurrenceRule) emit(`RRULE:${buildRRule(event.recurrenceRule, ctx)}`)
  for (const ex of event.recurrenceExceptions) {
    if (isValidISO(ex)) emit(dateProperty('EXDATE', ex, ctx))
  }
  for (const rd of event.recurrenceDates ?? []) {
    if (isValidISO(rd)) emit(dateProperty('RDATE', rd, ctx))
  }

  for (const attachment of event.attachments) {
    const inline = /^data:([^;,]+)?;base64,(.*)$/s.exec(attachment.uri)
    if (inline) {
      const fmt = attachment.mimeType || inline[1]
      emit(`ATTACH;${fmt ? `FMTTYPE=${paramValue(fmt)};` : ''}ENCODING=BASE64;VALUE=BINARY:${inline[2]}`)
      continue
    }
    const parts: string[] = []
    if (attachment.mimeType) parts.push(`FMTTYPE=${paramValue(attachment.mimeType)}`)
    if (attachment.size) parts.push(`SIZE=${attachment.size}`)
    parts.push('VALUE=URI')
    emit(`ATTACH;${parts.join(';')}:${plain(attachment.uri)}`)
  }

  if (!opts.stripAlarms) {
    for (const alarm of event.alarms) emitAlarm(emit, alarm, event, opts.includeAppleExtensions)
  }

  if (opts.includeAppleExtensions && event.apple) {
    const a = event.apple
    if (a.creatorIdentity) emit(`X-APPLE-CREATOR-IDENTITY:${plain(a.creatorIdentity)}`)
    if (a.creatorTeamIdentity) emit(`X-APPLE-CREATOR-TEAM-IDENTITY:${plain(a.creatorTeamIdentity)}`)
    if (a.travelAdvisory) emit(`X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:${a.travelAdvisory}`)
    if (a.structuredData) {
      const params = a.structuredDataParams ? `;${a.structuredDataParams}` : ''
      emit(`X-APPLE-STRUCTURED-DATA${params}:${plain(a.structuredData)}`)
    }
  }
  if (opts.includeGoogleExtensions && event.google?.conferenceUrl) {
    emit(`X-GOOGLE-CONFERENCE:${plain(event.google.conferenceUrl)}`)
  }
  if (opts.includeMicrosoftExtensions && event.microsoft) {
    const m = event.microsoft
    if (m.busyStatus) emit(`X-MICROSOFT-CDO-BUSYSTATUS:${plain(m.busyStatus)}`)
    if (m.importance) emit(`X-MICROSOFT-CDO-IMPORTANCE:${plain(m.importance)}`)
    if (m.ownerApptId) emit(`X-MICROSOFT-CDO-OWNERAPPTID:${plain(m.ownerApptId)}`)
  }

  emit('END:VEVENT')
}

const WEEK = 7 * 86_400_000
/** Most samples taken for one series; a longer span is sampled more sparsely. */
const MAX_SERIES_SAMPLES = 3000

/**
 * Instants an event puts on the wall clock of its zone: its own dates plus, for a
 * series, one sample a week from its start until its UNTIL or the end of the
 * fifth year after the current one, so a VTIMEZONE check covers the transitions
 * its occurrences cross (a monthly sample missed Gaza's short DST periods). The
 * end used to be start + 5 years, so the block of a series that began years ago
 * stopped short of its current occurrences. The window moves with the UTC year
 * only, so a feed body stays the same between edits within a year.
 */
function zoneSampleInstants(e: CalendarEvent, horizon: number): number[] {
  const out = [e.startDate, e.endDate, e.recurrenceId, ...e.recurrenceExceptions, ...(e.recurrenceDates ?? [])]
    .filter((x): x is string => !!x && isValidISO(x))
    .map((x) => Date.parse(x))
  if (e.recurrenceRule) {
    const start = Date.parse(e.startDate)
    const end = e.recurrenceRule.until && isValidISO(e.recurrenceRule.until) ? Math.min(Date.parse(e.recurrenceRule.until), horizon) : horizon
    const step = Math.max(WEEK, Math.ceil((end - start) / MAX_SERIES_SAMPLES))
    for (let t = start + step; t <= end; t += step) out.push(t)
  }
  return out
}

function withMailto(addr: string): string {
  return /^mailto:/i.test(addr) ? addr : `mailto:${addr}`
}

// ── Calendar ────────────────────────────────────────────────────────────────

export function generateICS(input: CalendarEvent[], options: GeneratorOptions = {}): string {
  const {
    includeAppleExtensions = true,
    includeGoogleExtensions = true,
    includeMicrosoftExtensions = true,
    stripPersonalData = false,
    stripAlarms = false,
    method,
    calendarName = APP_NAME,
    calendarDescription,
    calendarTimezone,
    calendarColor,
    refreshInterval,
    sourceUrl,
    busyLabel,
  } = options
  const level: RedactLevel = options.redactLevel ?? (stripPersonalData ? 'no-personal' : 'full')
  const now = options.now && isValidISO(options.now) ? options.now : new Date().toISOString()

  // At busy level, cancelled and free events are left out. For a recurring event
  // that must happen as a group: a left-out override (how one occurrence is
  // cancelled, freed or moved) becomes an EXDATE on its master, otherwise the
  // master expands that slot again; a left-out cancelled master takes its
  // overrides along.
  const droppedOverrides = new Map<string, string[]>()
  const droppedMasters = new Set<string>()
  for (const e of input) {
    if (includeAtLevel(e, level)) continue
    if (e.recurrenceId) droppedOverrides.set(e.uid, [...(droppedOverrides.get(e.uid) ?? []), e.recurrenceId])
    // Only a cancelled series cancels its overrides. A free (TRANSPARENT) series
    // can still have occurrences marked busy, and those stay in the feed.
    else if (e.status === 'CANCELLED') droppedMasters.add(e.uid)
  }
  const events = input
    .filter((e) => includeAtLevel(e, level) && !(e.recurrenceId && droppedMasters.has(e.uid)))
    .map((e) => {
      const r = redactEvent(e, level, { busyLabel })
      const extra = !e.recurrenceId ? droppedOverrides.get(e.uid) : undefined
      return extra ? { ...r, recurrenceExceptions: [...r.recurrenceExceptions, ...extra] } : r
    })

  // RECURRENCE-ID takes the value type of its master's DTSTART (RFC 5545
  // §3.8.4.4), not the override's own: an occurrence changed to all-day still
  // names a DATE-TIME occurrence of a timed series.
  const masterTime = new Map<string, TimeContext>()
  for (const e of events) if (!e.recurrenceId) masterTime.set(e.uid, { allDay: e.allDay, timezone: e.timezone })

  const lines: string[] = []
  // No value the generator writes legitimately contains CR or LF (TEXT is escaped,
  // parameters are RFC 6868-encoded), so any that reach this point were injected.
  // Dropping them here keeps every property one line in feeds and exports.
  const emit = (line: string) => lines.push(foldLine(line.replace(/[\r\n]+/g, '')))

  emit('BEGIN:VCALENDAR')
  emit('VERSION:2.0')
  emit(`PRODID:${PROD_ID}`)
  emit('CALSCALE:GREGORIAN')
  if (method === 'PUBLISH') emit('METHOD:PUBLISH')
  if (calendarName) {
    emit(`NAME:${escapeText(calendarName)}`)
    emit(`X-WR-CALNAME:${escapeText(calendarName)}`)
  }
  if (calendarDescription) {
    emit(`DESCRIPTION:${escapeText(calendarDescription)}`)
    emit(`X-WR-CALDESC:${escapeText(calendarDescription)}`)
  }
  if (calendarTimezone && isValidTimeZone(calendarTimezone)) emit(`X-WR-TIMEZONE:${calendarTimezone}`)
  if (calendarColor) {
    const name = toCssColorName(calendarColor)
    const hex = toHexColor(calendarColor)
    if (name) emit(`COLOR:${name}`)
    if (hex) emit(`X-APPLE-CALENDAR-COLOR:${hex.toUpperCase()}`)
  }
  if (refreshInterval) {
    const seconds = parseDuration(refreshInterval)
    if (seconds && seconds > 0) {
      const d = formatDuration(seconds)
      emit(`REFRESH-INTERVAL;VALUE=DURATION:${d}`)
      emit(`X-PUBLISHED-TTL:${d}`)
    }
  }
  if (sourceUrl) emit(`SOURCE;VALUE=URI:${plain(sourceUrl)}`)

  // One VTIMEZONE per zone actually used by a timed event (all-day events and UTC
  // events carry no TZID, so they need none).
  // Each block is checked against the runtime tz data at the instants this export
  // writes in that zone (see vtimezoneLinesFor).
  const horizon = Date.UTC(new Date().getUTCFullYear() + 6, 0, 1)
  const zoneInstants = new Map<string, number[]>()
  for (const e of events) {
    if (e.allDay || isUTCZone(e.timezone) || !isValidTimeZone(e.timezone)) continue
    const list = zoneInstants.get(e.timezone) ?? []
    for (const t of zoneSampleInstants(e, horizon)) list.push(t)
    zoneInstants.set(e.timezone, list)
  }
  for (const [tz, instants] of zoneInstants) {
    const block = vtimezoneLinesFor(tz, instants)
    if (block) for (const line of block) emit(line)
  }

  for (const event of events) {
    emitEvent(emit, event, { includeAppleExtensions, includeGoogleExtensions, includeMicrosoftExtensions, stripAlarms, now }, masterTime.get(event.uid))
  }

  emit('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

export function generateSingleEventICS(event: CalendarEvent, options?: GeneratorOptions): string {
  return generateICS([event], options)
}

export function generateCalendarMeta(): CalendarMeta {
  return { prodId: PROD_ID, version: '2.0', calscale: 'GREGORIAN' }
}
