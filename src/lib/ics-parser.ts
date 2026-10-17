import type {
  CalendarEvent, CalendarMeta, EventAlarm, EventAttachment, EventAttendee, ParsedCalendar,
  RecurrenceRule, TimezoneDefinition, TimezoneRule, WeekDay, ByDay,
} from '@/types'
import { createDefaultEvent, generateUID } from './utils'
import { normalizeEvent } from './normalize'
import { toHexColor } from './colors'
import {
  addDaysIn, endOfDayIn, formatICSUTC, hostTimeZone, isUTCZone, isValidTimeZone,
  parseDuration, parseICSDateValue, UTC_ZONE, type ParsedICSDate, type WallTime,
} from './time'
import { vtimezoneOffsetResolver } from './vtimezone'
import { windowsZoneToIana } from './windows-zones'

export interface ParseOptions {
  /** Zone for floating times and all-day dates. Defaults to the host zone. */
  defaultTimezone?: string
}

// ── Lexing ──────────────────────────────────────────────────────────────────

interface Property {
  name: string
  params: Record<string, string>
  value: string
}

interface Component {
  name: string
  props: Property[]
  children: Component[]
}

/** Unfold at the byte level, then decode — a fold inside a UTF-8 sequence stays intact. */
export function unfoldBytes(bytes: Uint8Array): string {
  const out = new Uint8Array(bytes.length)
  let o = 0
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    const next = bytes[i + 1]
    if (b === 0x0d && next === 0x0a && (bytes[i + 2] === 0x20 || bytes[i + 2] === 0x09)) { i += 2; continue }
    if ((b === 0x0a || b === 0x0d) && (next === 0x20 || next === 0x09)) { i += 1; continue }
    out[o++] = b
  }
  return new TextDecoder('utf-8').decode(out.subarray(0, o))
}

function contentLines(raw: string): string[] {
  return raw
    .replace(/^﻿/, '')
    .replace(/\r\n|\r|\n/g, '\n') // CRLF, LF-only and CR-only files
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .filter((l) => l.trim().length > 0)
}

/** RFC 6868 parameter-value decoding: ^n → newline, ^' → ", ^^ → ^. */
function decodeParam(v: string): string {
  return v.replace(/\^(\^|n|N|')/g, (_, c: string) => (c === '^' ? '^' : c === "'" ? '"' : '\n'))
}

function parseContentLine(line: string): Property | null {
  const n = line.length
  let i = 0
  while (i < n && line[i] !== ';' && line[i] !== ':') i++
  const name = line.slice(0, i).trim().toUpperCase()
  if (!name) return null
  const params: Record<string, string> = {}
  while (i < n && line[i] === ';') {
    i++
    let j = i
    while (j < n && line[j] !== '=' && line[j] !== ';' && line[j] !== ':') j++
    const pname = line.slice(i, j).trim().toUpperCase()
    if (line[j] !== '=') { i = j; continue }
    i = j + 1
    const values: string[] = []
    for (;;) {
      if (line[i] === '"') {
        const close = line.indexOf('"', i + 1)
        if (close === -1) { values.push(line.slice(i + 1)); i = n; break }
        values.push(line.slice(i + 1, close))
        i = close + 1
      } else {
        let k = i
        while (k < n && line[k] !== ',' && line[k] !== ';' && line[k] !== ':') k++
        values.push(line.slice(i, k))
        i = k
      }
      if (line[i] === ',') { i++; continue }
      break
    }
    if (pname) params[pname] = values.map(decodeParam).join(',')
  }
  if (line[i] !== ':') return null
  return { name, params, value: line.slice(i + 1) }
}

function buildTree(lines: string[]): Component {
  const root: Component = { name: 'ROOT', props: [], children: [] }
  const stack: Component[] = [root]
  for (const line of lines) {
    const prop = parseContentLine(line)
    if (!prop) continue
    if (prop.name === 'BEGIN') {
      const c: Component = { name: prop.value.trim().toUpperCase(), props: [], children: [] }
      stack[stack.length - 1]!.children.push(c)
      stack.push(c)
    } else if (prop.name === 'END') {
      const target = prop.value.trim().toUpperCase()
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k]!.name === target) { stack.length = k; break }
      }
    } else {
      stack[stack.length - 1]!.props.push(prop)
    }
  }
  return root
}

function descendants(c: Component, name: string): Component[] {
  const out: Component[] = []
  for (const child of c.children) {
    if (child.name === name) out.push(child)
    else out.push(...descendants(child, name))
  }
  return out
}

// ── Values ──────────────────────────────────────────────────────────────────

/** Single-pass TEXT unescape, so `\\n` stays a backslash + "n" (the old chain turned it into a newline). */
export function unescapeText(text: string): string {
  return text.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c))
}

/** Split on separators that are not backslash-escaped. */
function splitUnescaped(value: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!
    if (ch === '\\' && i + 1 < value.length) { cur += ch + value[i + 1]; i++; continue }
    if (ch === sep) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

function stripMailto(v: string): string {
  return v.trim().replace(/^mailto:/i, '')
}

/** Re-serialise parsed parameters, RFC 6868-encoding values (^^, ^n, ^') as decodeParam undid them. */
function serializeParams(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => {
      const enc = v.replace(/\^/g, '^^').replace(/\r\n?|\n/g, '^n').replace(/"/g, "^'")
      return `${k}=${/[;:,]/.test(enc) ? `"${enc}"` : enc}`
    })
    .join(';')
}

// ── Time zone resolution ────────────────────────────────────────────────────

interface ZoneContext {
  defaultZone: string
  calendarZone: string | null
  defs: Map<string, TimezoneDefinition>
}

interface DateRead extends ParsedICSDate {
  /** IANA zone to store on the event, derived from this value. */
  zone: string
}

function readDate(value: string, params: Record<string, string>, ctx: ZoneContext): DateRead | null {
  const tzid = params['TZID']?.trim()
  const isDateParam = params['VALUE']?.toUpperCase() === 'DATE'
  let zone = ctx.defaultZone
  let resolver: ((w: WallTime) => number | null) | undefined
  if (tzid) {
    if (isUTCZone(tzid)) zone = UTC_ZONE
    else if (isValidTimeZone(tzid)) zone = tzid
    else {
      // Windows zone names (Outlook, Exchange) map to their IANA zone, so a series
      // keeps repeating on the organiser's DST rules. Anything else non-IANA: the
      // file's VTIMEZONE gives the exact instant, and the event takes the user's
      // zone since its own has no IANA name.
      const mapped = windowsZoneToIana(tzid)
      if (mapped) zone = mapped
      else {
        const def = ctx.defs.get(tzid)
        resolver = def ? vtimezoneOffsetResolver(def) ?? undefined : undefined
      }
    }
  }
  const parsed = parseICSDateValue(value, { isDateParam, zone, offsetResolver: resolver })
  if (!parsed) return null
  let eventZone = zone
  if (parsed.kind === 'utc') eventZone = ctx.calendarZone ?? ctx.defaultZone
  return { ...parsed, zone: eventZone }
}

/**
 * A date property's literal value moved by `days` calendar days and read back
 * with its own parameters, so the days follow that value's clock: UTC for a Z
 * value, its TZID's rules, or the file's VTIMEZONE.
 */
function shiftDays(prop: Property, days: number, ctx: ZoneContext): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(.*)$/.exec(prop.value.trim())
  if (!m) return null
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]! + days))
  if (Number.isNaN(d.getTime())) return null
  const p2 = (n: number) => String(n).padStart(2, '0')
  const value = `${String(d.getUTCFullYear()).padStart(4, '0')}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}${m[4]}`
  return readDate(value, prop.params, ctx)?.iso ?? null
}

// ── Components → model ──────────────────────────────────────────────────────

function parseTimezone(c: Component): TimezoneDefinition {
  const def: TimezoneDefinition = { tzid: c.props.find((p) => p.name === 'TZID')?.value.trim() ?? '' }
  for (const kind of ['STANDARD', 'DAYLIGHT'] as const) {
    // Keep the most recent observance of each kind; older ones describe history.
    let latest: TimezoneRule | undefined
    for (const obs of c.children.filter((ch) => ch.name === kind)) {
      const get = (n: string) => obs.props.find((p) => p.name === n)?.value.trim()
      const rule: TimezoneRule = {
        dtstart: get('DTSTART') ?? '',
        rrule: get('RRULE'),
        tzname: get('TZNAME') ?? '',
        tzoffsetfrom: get('TZOFFSETFROM') ?? '+0000',
        tzoffsetto: get('TZOFFSETTO') ?? '+0000',
      }
      if (!latest || rule.dtstart > latest.dtstart) latest = rule
    }
    if (latest) def[kind === 'STANDARD' ? 'standard' : 'daylight'] = latest
  }
  return def
}

const nums = (v: string) => v.split(',').map((x) => parseInt(x, 10)).filter((x) => Number.isFinite(x))

function parseRRule(value: string, ctx: ZoneContext, eventZone: string, allDay: boolean): RecurrenceRule {
  const rule: RecurrenceRule = { frequency: 'DAILY', interval: 1 }
  for (const part of value.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim().toUpperCase()
    const val = part.slice(eq + 1).trim()
    switch (key) {
      case 'FREQ': rule.frequency = val.toUpperCase() as RecurrenceRule['frequency']; break
      case 'INTERVAL': rule.interval = parseInt(val, 10) || 1; break
      case 'COUNT': rule.count = parseInt(val, 10) || undefined; break
      case 'UNTIL': {
        const d = readDate(val, {}, { ...ctx, defaultZone: eventZone })
        if (!d) break
        // A DATE UNTIL on a timed event (invalid but common) means "through that day".
        rule.until = d.isDate && !allDay ? endOfDayIn(d.iso, eventZone) : d.iso
        break
      }
      case 'BYDAY': rule.byDay = val.toUpperCase().split(',').filter(Boolean) as ByDay[]; break
      case 'BYMONTHDAY': rule.byMonthDay = nums(val); break
      case 'BYMONTH': rule.byMonth = nums(val); break
      case 'BYSETPOS': rule.bySetPos = nums(val); break
      case 'BYYEARDAY': rule.byYearDay = nums(val); break
      case 'BYWEEKNO': rule.byWeekNo = nums(val); break
      case 'BYHOUR': rule.byHour = nums(val); break
      case 'BYMINUTE': rule.byMinute = nums(val); break
      case 'BYSECOND': rule.bySecond = nums(val); break
      case 'WKST': rule.weekStart = val.toUpperCase() as WeekDay; break
    }
  }
  return rule
}

function parseAttendee(prop: Property): EventAttendee {
  const up = (k: string) => prop.params[k]?.toUpperCase()
  return {
    name: prop.params['CN'] ?? '',
    email: stripMailto(prop.value),
    role: (up('ROLE') as EventAttendee['role']) ?? 'REQ-PARTICIPANT',
    status: (up('PARTSTAT') as EventAttendee['status']) ?? 'NEEDS-ACTION',
    type: (up('CUTYPE') as EventAttendee['type']) ?? 'INDIVIDUAL',
    rsvp: up('RSVP') === 'TRUE',
    dir: prop.params['DIR'],
    delegatedFrom: prop.params['DELEGATED-FROM'] ? prop.params['DELEGATED-FROM'].split(',').map(stripMailto).join(',') : undefined,
    delegatedTo: prop.params['DELEGATED-TO'] ? prop.params['DELEGATED-TO'].split(',').map(stripMailto).join(',') : undefined,
  }
}

function parseAlarm(c: Component, ctx: ZoneContext): EventAlarm {
  const alarm: EventAlarm = {
    uid: generateUID(),
    action: 'DISPLAY',
    trigger: '-PT15M',
    triggerRelation: 'START',
    description: '',
    isDefault: false,
  }
  for (const prop of c.props) {
    switch (prop.name) {
      case 'ACTION': alarm.action = prop.value.trim().toUpperCase() as EventAlarm['action']; break
      case 'TRIGGER': {
        const v = prop.value.trim()
        if (prop.params['VALUE']?.toUpperCase() === 'DATE-TIME' || /^\d{8}T\d{6}/.test(v)) {
          const d = readDate(v, {}, { ...ctx, defaultZone: UTC_ZONE })
          if (d) alarm.trigger = formatICSUTC(d.iso)
        } else {
          alarm.trigger = v
          if (prop.params['RELATED']?.toUpperCase() === 'END') alarm.triggerRelation = 'END'
        }
        break
      }
      case 'DESCRIPTION': alarm.description = unescapeText(prop.value); break
      case 'SUMMARY': alarm.summary = unescapeText(prop.value); break
      case 'DURATION': alarm.duration = prop.value.trim(); break
      case 'REPEAT': alarm.repeat = parseInt(prop.value, 10) || undefined; break
      case 'UID': alarm.uid = prop.value.trim(); break
      case 'ACKNOWLEDGED': {
        const d = readDate(prop.value, prop.params, { ...ctx, defaultZone: UTC_ZONE })
        if (d) alarm.acknowledged = d.iso
        break
      }
      case 'ATTACH': alarm.attachUri = prop.value.trim(); break
      case 'X-APPLE-DEFAULT-ALARM': alarm.isDefault = prop.value.trim().toUpperCase() === 'TRUE'; break
      case 'X-WR-ALARMUID': alarm.uid = prop.value.trim(); break
    }
  }
  return alarm
}

function parseEvent(c: Component, ctx: ZoneContext): CalendarEvent | null {
  const event = createDefaultEvent({ created: '', lastModified: '', dtstamp: '' })
  const dtstartProp = c.props.find((p) => p.name === 'DTSTART')
  if (!dtstartProp) return null
  const start = readDate(dtstartProp.value, dtstartProp.params, ctx)
  if (!start) return null
  event.startDate = start.iso
  event.allDay = start.isDate
  // A UTC DTSTART with a recurrence repeats at a fixed UTC time. Giving it a DST
  // zone (the calendar's or the user's) would re-anchor it to local wall time and
  // move every occurrence after the next DST change, so such a series stays UTC.
  // A one-off UTC event is shown in the calendar's/user's zone as before.
  const recurs = c.props.some((p) => p.name === 'RRULE' || p.name === 'RDATE')
  event.timezone = start.kind === 'utc' && recurs ? UTC_ZONE : start.zone
  const zone = event.timezone

  const at = (p: Property) => readDate(p.value, p.params, { ...ctx, defaultZone: zone })
  const categories: string[] = []
  const resources: string[] = []
  const attendees: EventAttendee[] = []
  const attachments: EventAttachment[] = []
  let endIso: string | null = null
  let durationSeconds: number | null = null
  let durationRaw = ''

  for (const prop of c.props) {
    const v = prop.value
    switch (prop.name) {
      case 'UID': event.uid = v.trim(); break
      case 'SUMMARY': event.summary = unescapeText(v); break
      case 'DESCRIPTION': event.description = unescapeText(v); break
      case 'COMMENT': event.comment = unescapeText(v); break
      case 'DTEND': endIso = at(prop)?.iso ?? null; break
      case 'DURATION': durationSeconds = parseDuration(v); durationRaw = v.trim(); break
      case 'CREATED': event.created = at(prop)?.iso ?? ''; break
      case 'LAST-MODIFIED': event.lastModified = at(prop)?.iso ?? ''; break
      case 'DTSTAMP': event.dtstamp = at(prop)?.iso ?? ''; break
      case 'SEQUENCE': event.sequence = parseInt(v, 10) || 0; break
      case 'STATUS': event.status = v.trim().toUpperCase() as CalendarEvent['status']; break
      case 'CLASS': event.classification = v.trim().toUpperCase() as CalendarEvent['classification']; break
      case 'TRANSP': event.transparency = v.trim().toUpperCase() as CalendarEvent['transparency']; break
      case 'PRIORITY': event.priority = parseInt(v, 10) || 0; break
      case 'URL': event.url = v.trim(); break
      case 'COLOR': event.color = toHexColor(v) ?? ''; break
      case 'CONTACT': event.contact = unescapeText(v); break
      case 'RELATED-TO': event.relatedTo = v.trim(); break
      case 'RECURRENCE-ID': {
        // A DATE value names a day of an all-day master, whose dates are read in
        // the import zone (ctx). Reading it in the override's own DTSTART zone put
        // it on the previous day for importers west of that zone.
        const isDate = prop.params['VALUE']?.toUpperCase() === 'DATE' || /^\d{8}$/.test(v.trim())
        event.recurrenceId = (isDate ? readDate(v, prop.params, ctx) : at(prop))?.iso ?? ''
        break
      }
      case 'CATEGORIES':
        categories.push(...splitUnescaped(v, ',').map((x) => unescapeText(x).trim()).filter(Boolean))
        break
      case 'RESOURCES':
        resources.push(...splitUnescaped(v, ',').map((x) => unescapeText(x).trim()).filter(Boolean))
        break
      case 'LOCATION':
        event.location = { ...(event.location ?? { text: '' }), text: unescapeText(v) }
        break
      case 'GEO': {
        const [lat, lon] = v.split(/[;,]/).map(Number)
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          event.location = { ...(event.location ?? { text: '' }), geo: { latitude: lat!, longitude: lon! } }
        }
        break
      }
      case 'ORGANIZER':
        event.organizer = {
          name: prop.params['CN'] ?? '',
          email: stripMailto(v),
          dir: prop.params['DIR'],
          sentBy: prop.params['SENT-BY'] ? stripMailto(prop.params['SENT-BY']) : undefined,
        }
        break
      case 'ATTENDEE': attendees.push(parseAttendee(prop)); break
      case 'RRULE': event.recurrenceRule = parseRRule(v, ctx, zone, start.isDate); break
      case 'EXDATE':
      case 'RDATE': {
        if (prop.params['VALUE']?.toUpperCase() === 'PERIOD') break
        const list = v.split(',').map((x) => x.trim()).filter((x) => x && !x.includes('/'))
        const target = prop.name === 'EXDATE' ? event.recurrenceExceptions : (event.recurrenceDates ??= [])
        for (const item of list) {
          const d = readDate(item, prop.params, { ...ctx, defaultZone: zone })
          if (d) target.push(d.iso)
        }
        break
      }
      case 'ATTACH': {
        const binary = prop.params['ENCODING']?.toUpperCase() === 'BASE64' || prop.params['VALUE']?.toUpperCase() === 'BINARY'
        const mime = prop.params['FMTTYPE']
        attachments.push({
          uri: binary ? `data:${mime || 'application/octet-stream'};base64,${v.trim()}` : v.trim(),
          mimeType: mime,
          size: prop.params['SIZE'] ? parseInt(prop.params['SIZE'], 10) : undefined,
        })
        break
      }
      case 'X-APPLE-CREATOR-IDENTITY': event.apple = { ...event.apple, creatorIdentity: v.trim() }; break
      case 'X-APPLE-CREATOR-TEAM-IDENTITY': event.apple = { ...event.apple, creatorTeamIdentity: v.trim() }; break
      case 'X-APPLE-TRAVEL-ADVISORY-BEHAVIOR':
        event.apple = { ...event.apple, travelAdvisory: v.trim().toUpperCase() as 'AUTOMATIC' | 'DISABLED' | 'ENABLED' }
        break
      case 'X-APPLE-STRUCTURED-DATA':
        event.apple = { ...event.apple, structuredData: v.trim(), structuredDataParams: serializeParams(prop.params) || undefined }
        break
      case 'X-APPLE-STRUCTURED-LOCATION': {
        event.apple = { ...event.apple, structuredLocation: v.trim() }
        const loc = { ...(event.location ?? { text: '' }) }
        if (prop.params['X-APPLE-MAPKIT-HANDLE']) loc.appleMapItemHandle = prop.params['X-APPLE-MAPKIT-HANDLE'].replace(/\s/g, '')
        if (prop.params['X-APPLE-RADIUS']) loc.appleRadius = parseFloat(prop.params['X-APPLE-RADIUS'])
        if (prop.params['X-ADDRESS']) loc.appleAddress = prop.params['X-ADDRESS']
        if (prop.params['X-TITLE']) loc.appleTitle = prop.params['X-TITLE']
        const geo = /^geo:([-\d.]+),([-\d.]+)/i.exec(v.trim())
        if (geo && !loc.geo) loc.geo = { latitude: +geo[1]!, longitude: +geo[2]! }
        // If only one of address/title is present, use it for both.
        if (!loc.appleAddress && loc.appleTitle) loc.appleAddress = loc.appleTitle
        else if (!loc.appleTitle && loc.appleAddress) loc.appleTitle = loc.appleAddress
        event.location = loc
        break
      }
      case 'X-GOOGLE-CONFERENCE': event.google = { ...event.google, conferenceUrl: v.trim() }; break
      case 'X-MICROSOFT-CDO-BUSYSTATUS': event.microsoft = { ...event.microsoft, busyStatus: v.trim() }; break
      case 'X-MICROSOFT-CDO-IMPORTANCE': event.microsoft = { ...event.microsoft, importance: v.trim() }; break
      case 'X-MICROSOFT-CDO-OWNERAPPTID': event.microsoft = { ...event.microsoft, ownerApptId: v.trim() }; break
    }
  }

  // DTEND, else DURATION, else the RFC 5545 §3.6.1 defaults (one day for a DATE
  // DTSTART, zero length otherwise). Previously a missing DTEND became "import time + 1h".
  if (endIso) {
    event.endDate = endIso
  } else if (durationSeconds !== null) {
    // Week and day parts are nominal (RFC 5545 §3.3.6): the same wall time N days
    // later on DTSTART's own clock, so P1D across a DST change is 23 or 25 hours
    // in a DST zone and exactly 24 in UTC. Only the time part is exact. Counting
    // the days in the display zone made a UTC or VTIMEZONE-resolved event an
    // hour longer or shorter depending on the importer's zone.
    const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?/i.exec(durationRaw)
    const sign = m?.[1] === '-' ? -1 : 1
    const days = sign * (Number(m?.[2] ?? 0) * 7 + Number(m?.[3] ?? 0))
    const rest = durationSeconds - days * 86400
    const base = days ? (shiftDays(dtstartProp, days, ctx) ?? event.startDate) : event.startDate
    event.endDate = new Date(new Date(base).getTime() + rest * 1000).toISOString()
  } else {
    event.endDate = event.allDay ? addDaysIn(event.startDate, 1, zone) : event.startDate
  }

  event.categories = [...new Set(categories)]
  event.resources = [...new Set(resources)]
  event.attendees = attendees
  event.attachments = attachments
  event.alarms = c.children.filter((ch) => ch.name === 'VALARM').map((a) => parseAlarm(a, ctx))
  // Without LAST-MODIFIED, the revision time is DTSTAMP (RFC 5545 §3.8.7.2).
  if (!event.lastModified) event.lastModified = event.dtstamp || event.created || ''

  return normalizeEvent(event)
}

export function parseICS(content: string, options: ParseOptions = {}): ParsedCalendar {
  const tree = buildTree(contentLines(content))
  const calendars = descendants(tree, 'VCALENDAR')
  const roots = calendars.length > 0 ? calendars : [tree]
  const meta: CalendarMeta = { prodId: '', version: '2.0', calscale: 'GREGORIAN' }
  const timezones: TimezoneDefinition[] = []
  const events: CalendarEvent[] = []

  for (const cal of roots) {
    for (const p of cal.props) {
      switch (p.name) {
        case 'PRODID': meta.prodId ||= p.value.trim(); break
        case 'VERSION': meta.version = p.value.trim(); break
        case 'CALSCALE': meta.calscale = p.value.trim(); break
        case 'METHOD': meta.method = p.value.trim().toUpperCase(); break
        case 'NAME':
        case 'X-WR-CALNAME': meta.calendarName ||= unescapeText(p.value); break
        case 'X-APPLE-CALENDAR-COLOR': meta.calendarColor = p.value.trim(); break
        case 'X-WR-TIMEZONE': meta.calendarTimezone = p.value.trim(); break
      }
    }
    const tzComponents = descendants(cal, 'VTIMEZONE').map(parseTimezone)
    timezones.push(...tzComponents)
    const ctx: ZoneContext = {
      defaultZone: isValidTimeZone(options.defaultTimezone) ? options.defaultTimezone : hostTimeZone(),
      calendarZone: isValidTimeZone(meta.calendarTimezone) ? meta.calendarTimezone! : null,
      defs: new Map(tzComponents.map((d) => [d.tzid, d])),
    }
    for (const ve of descendants(cal, 'VEVENT')) {
      const ev = parseEvent(ve, ctx)
      if (ev) events.push(ev)
    }
  }

  return { meta, timezones, events }
}

export function parseICSBytes(bytes: Uint8Array, options?: ParseOptions): ParsedCalendar {
  return parseICS(unfoldBytes(bytes), options)
}

export async function parseICSFile(file: File, options?: ParseOptions): Promise<ParsedCalendar> {
  return parseICSBytes(new Uint8Array(await file.arrayBuffer()), options)
}
