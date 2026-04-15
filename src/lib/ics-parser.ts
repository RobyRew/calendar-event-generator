import type { CalendarEvent, EventAlarm, EventAttendee, RecurrenceRule, ParsedCalendar, TimezoneDefinition, CalendarMeta, WeekDay, EventAttachment } from '@/types'
import { createDefaultEvent, generateUID } from './utils'

function unfoldLines(raw: string): string[] {
  const unfolded = raw.replace(/\r\n[ \t]/g, '').replace(/\r/g, '')
  return unfolded.split('\n').filter((l) => l.length > 0)
}

interface Property {
  name: string
  params: Record<string, string>
  value: string
}

function parseLine(line: string): Property {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return { name: '', params: {}, value: line }

  const before = line.substring(0, colonIdx)
  const value = line.substring(colonIdx + 1)

  const semiIdx = before.indexOf(';')
  if (semiIdx === -1) return { name: before.toUpperCase(), params: {}, value }

  const name = before.substring(0, semiIdx).toUpperCase()
  const paramStr = before.substring(semiIdx + 1)
  const params: Record<string, string> = {}

  const paramParts = paramStr.match(/([^;=]+)=("(?:[^"]*(?:"[^"]*)*[^"]*)"?|[^;]*)/g)
  if (paramParts) {
    for (const part of paramParts) {
      const eq = part.indexOf('=')
      if (eq === -1) continue
      const key = part.substring(0, eq).toUpperCase()
      let val = part.substring(eq + 1)
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      params[key] = val
    }
  }

  return { name, params, value }
}

function parseDate(value: string, params: Record<string, string>): string {
  const isDateOnly = params['VALUE'] === 'DATE' || value.length === 8
  if (isDateOnly) {
    const y = value.substring(0, 4)
    const m = value.substring(4, 6)
    const d = value.substring(6, 8)
    return new Date(`${y}-${m}-${d}T00:00:00`).toISOString()
  }

  const clean = value.replace(/[^0-9TZ+-]/g, '')
  if (clean.endsWith('Z')) {
    const y = clean.substring(0, 4)
    const m = clean.substring(4, 6)
    const d = clean.substring(6, 8)
    const h = clean.substring(9, 11)
    const mi = clean.substring(11, 13)
    const s = clean.substring(13, 15) || '00'
    return new Date(`${y}-${m}-${d}T${h}:${mi}:${s}Z`).toISOString()
  }

  const y = clean.substring(0, 4)
  const mo = clean.substring(4, 6)
  const d = clean.substring(6, 8)
  const h = clean.substring(9, 11) || '00'
  const mi = clean.substring(11, 13) || '00'
  const s = clean.substring(13, 15) || '00'
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).toISOString()
}

function unescapeText(text: string): string {
  return text
    .replace(/\\n/gi, '\n')
    .replace(/\\;/g, ';')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\')
}

function parseRRule(value: string): RecurrenceRule {
  const parts = value.split(';')
  const rule: RecurrenceRule = { frequency: 'DAILY', interval: 1 }
  for (const part of parts) {
    const [key, val] = part.split('=')
    if (!key || !val) continue
    switch (key.toUpperCase()) {
      case 'FREQ': rule.frequency = val as RecurrenceRule['frequency']; break
      case 'INTERVAL': rule.interval = parseInt(val, 10); break
      case 'COUNT': rule.count = parseInt(val, 10); break
      case 'UNTIL': rule.until = parseDate(val, { VALUE: val.length === 8 ? 'DATE' : '' }); break
      case 'BYDAY': rule.byDay = val.split(',') as WeekDay[]; break
      case 'BYMONTHDAY': rule.byMonthDay = val.split(',').map(Number); break
      case 'BYMONTH': rule.byMonth = val.split(',').map(Number); break
      case 'BYSETPOS': rule.bySetPos = val.split(',').map(Number); break
      case 'WKST': rule.weekStart = val as WeekDay; break
    }
  }
  return rule
}

function parseAttendee(prop: Property): EventAttendee {
  return {
    name: prop.params['CN']?.replace(/"/g, '') ?? '',
    email: prop.value.replace('mailto:', '').replace('MAILTO:', ''),
    role: (prop.params['ROLE'] as EventAttendee['role']) ?? 'REQ-PARTICIPANT',
    status: (prop.params['PARTSTAT'] as EventAttendee['status']) ?? 'NEEDS-ACTION',
    type: (prop.params['CUTYPE'] as EventAttendee['type']) ?? 'INDIVIDUAL',
    rsvp: prop.params['RSVP']?.toUpperCase() === 'TRUE',
    delegatedFrom: prop.params['DELEGATED-FROM'],
    delegatedTo: prop.params['DELEGATED-TO'],
  }
}

function parseAlarm(lines: string[]): EventAlarm {
  const alarm: EventAlarm = {
    uid: generateUID(),
    action: 'DISPLAY',
    trigger: '-PT15M',
    triggerRelation: 'START',
    description: 'Reminder',
    isDefault: false,
  }

  for (const line of lines) {
    const prop = parseLine(line)
    switch (prop.name) {
      case 'ACTION': alarm.action = prop.value as EventAlarm['action']; break
      case 'TRIGGER':
        alarm.trigger = prop.value
        if (prop.params['RELATED']?.toUpperCase() === 'END') alarm.triggerRelation = 'END'
        break
      case 'DESCRIPTION': alarm.description = unescapeText(prop.value); break
      case 'SUMMARY': alarm.summary = unescapeText(prop.value); break
      case 'DURATION': alarm.duration = prop.value; break
      case 'REPEAT': alarm.repeat = parseInt(prop.value, 10); break
      case 'UID': alarm.uid = prop.value; break
      case 'ACKNOWLEDGED': alarm.acknowledged = prop.value; break
      case 'ATTACH':
        alarm.attachUri = prop.value
        break
      case 'X-APPLE-DEFAULT-ALARM':
        alarm.isDefault = prop.value.toUpperCase() === 'TRUE'
        break
      case 'X-WR-ALARMUID':
        alarm.uid = prop.value
        break
    }
  }
  return alarm
}

export function parseICS(content: string): ParsedCalendar {
  const lines = unfoldLines(content)
  const meta: CalendarMeta = { prodId: '', version: '2.0', calscale: 'GREGORIAN' }
  const timezones: TimezoneDefinition[] = []
  const events: CalendarEvent[] = []

  let i = 0
  while (i < lines.length) {
    const prop = parseLine(lines[i]!)
    switch (prop.name) {
      case 'PRODID': meta.prodId = prop.value; break
      case 'VERSION': meta.version = prop.value; break
      case 'CALSCALE': meta.calscale = prop.value; break
      case 'METHOD': meta.method = prop.value; break
      case 'X-WR-CALNAME': meta.calendarName = prop.value; break
      case 'X-APPLE-CALENDAR-COLOR': meta.calendarColor = prop.value; break
    }

    if (prop.value === 'VTIMEZONE' && prop.name === 'BEGIN') {
      const tz: TimezoneDefinition = { tzid: '' }
      i++
      while (i < lines.length) {
        const tzLine = parseLine(lines[i]!)
        if (tzLine.name === 'END' && tzLine.value === 'VTIMEZONE') break
        if (tzLine.name === 'TZID') tz.tzid = tzLine.value
        i++
      }
      timezones.push(tz)
    }

    if (prop.value === 'VEVENT' && prop.name === 'BEGIN') {
      const event = createDefaultEvent()
      const alarms: EventAlarm[] = []
      const attendees: EventAttendee[] = []
      const attachments: EventAttachment[] = []
      let tz = ''
      i++

      while (i < lines.length) {
        const eLine = parseLine(lines[i]!)

        if (eLine.name === 'END' && eLine.value === 'VEVENT') break

        if (eLine.name === 'BEGIN' && eLine.value === 'VALARM') {
          const alarmLines: string[] = []
          i++
          while (i < lines.length) {
            const aLine = lines[i]!
            if (aLine.trim().toUpperCase() === 'END:VALARM') break
            alarmLines.push(aLine)
            i++
          }
          alarms.push(parseAlarm(alarmLines))
          i++
          continue
        }

        switch (eLine.name) {
          case 'UID': event.uid = eLine.value; break
          case 'SUMMARY': event.summary = unescapeText(eLine.value); break
          case 'DESCRIPTION': event.description = unescapeText(eLine.value); break
          case 'COMMENT': event.comment = unescapeText(eLine.value); break
          case 'DTSTART':
            event.startDate = parseDate(eLine.value, eLine.params)
            event.allDay = eLine.params['VALUE'] === 'DATE' || eLine.value.length === 8
            if (eLine.params['TZID']) tz = eLine.params['TZID']
            break
          case 'DTEND':
            event.endDate = parseDate(eLine.value, eLine.params)
            break
          case 'CREATED': event.created = parseDate(eLine.value, eLine.params); break
          case 'LAST-MODIFIED': event.lastModified = parseDate(eLine.value, eLine.params); break
          case 'DTSTAMP': event.dtstamp = parseDate(eLine.value, eLine.params); break
          case 'SEQUENCE': event.sequence = parseInt(eLine.value, 10) || 0; break
          case 'STATUS': event.status = eLine.value as CalendarEvent['status']; break
          case 'CLASS': event.classification = eLine.value as CalendarEvent['classification']; break
          case 'TRANSP': event.transparency = eLine.value as CalendarEvent['transparency']; break
          case 'PRIORITY': event.priority = parseInt(eLine.value, 10) || 0; break
          case 'URL': event.url = eLine.value; break
          case 'COLOR': event.color = eLine.value; break
          case 'CONTACT': event.contact = unescapeText(eLine.value); break
          case 'RELATED-TO': event.relatedTo = eLine.value; break
          case 'RECURRENCE-ID': event.recurrenceId = eLine.value; break
          case 'CATEGORIES':
            event.categories = eLine.value.split(',').map((c) => unescapeText(c.trim()))
            break
          case 'RESOURCES':
            event.resources = eLine.value.split(',').map((r) => unescapeText(r.trim()))
            break
          case 'LOCATION':
            event.location = {
              ...(event.location ?? { text: '' }),
              text: unescapeText(eLine.value),
            }
            break
          case 'GEO': {
            const [lat, lon] = eLine.value.split(';').map(Number)
            if (lat !== undefined && lon !== undefined) {
              event.location = {
                ...(event.location ?? { text: '' }),
                geo: { latitude: lat, longitude: lon },
              }
            }
            break
          }
          case 'ORGANIZER':
            event.organizer = {
              name: eLine.params['CN']?.replace(/"/g, '') ?? '',
              email: eLine.value.replace(/mailto:/i, ''),
            }
            break
          case 'ATTENDEE':
            attendees.push(parseAttendee(eLine))
            break
          case 'RRULE':
            event.recurrenceRule = parseRRule(eLine.value)
            break
          case 'EXDATE':
            event.recurrenceExceptions.push(parseDate(eLine.value, eLine.params))
            break
          case 'ATTACH': {
            const att: EventAttachment = {
              uri: eLine.value,
              mimeType: eLine.params['FMTTYPE'],
              size: eLine.params['SIZE'] ? parseInt(eLine.params['SIZE'], 10) : undefined,
            }
            attachments.push(att)
            break
          }
          case 'X-APPLE-CREATOR-IDENTITY':
            event.apple = { ...event.apple, creatorIdentity: eLine.value }
            break
          case 'X-APPLE-CREATOR-TEAM-IDENTITY':
            event.apple = { ...event.apple, creatorTeamIdentity: eLine.value }
            break
          case 'X-APPLE-TRAVEL-ADVISORY-BEHAVIOR':
            event.apple = { ...event.apple, travelAdvisory: eLine.value as 'AUTOMATIC' | 'DISABLED' | 'ENABLED' }
            break
          case 'X-APPLE-STRUCTURED-DATA':
            event.apple = { ...event.apple, structuredData: eLine.value }
            break
          case 'X-APPLE-STRUCTURED-LOCATION':
            event.apple = { ...event.apple, structuredLocation: eLine.value }
            if (eLine.params['X-APPLE-MAPKIT-HANDLE']) {
              event.location = {
                ...(event.location ?? { text: '' }),
                appleMapItemHandle: eLine.params['X-APPLE-MAPKIT-HANDLE'],
              }
            }
            if (eLine.params['X-APPLE-RADIUS']) {
              event.location = {
                ...(event.location ?? { text: '' }),
                appleRadius: parseFloat(eLine.params['X-APPLE-RADIUS']),
              }
            }
            if (eLine.params['X-ADDRESS']) {
              event.location = {
                ...(event.location ?? { text: '' }),
                appleAddress: eLine.params['X-ADDRESS'].replace(/"/g, ''),
              }
            }
            if (eLine.params['X-TITLE']) {
              event.location = {
                ...(event.location ?? { text: '' }),
                appleTitle: eLine.params['X-TITLE'],
              }
            }
            break
          case 'X-GOOGLE-CONFERENCE':
            event.google = { ...event.google, conferenceUrl: eLine.value }
            break
          case 'X-MICROSOFT-CDO-BUSYSTATUS':
            event.microsoft = { ...event.microsoft, busyStatus: eLine.value }
            break
          case 'X-MICROSOFT-CDO-IMPORTANCE':
            event.microsoft = { ...event.microsoft, importance: eLine.value }
            break
          case 'X-MICROSOFT-CDO-OWNERAPPTID':
            event.microsoft = { ...event.microsoft, ownerApptId: eLine.value }
            break
        }
        i++
      }

      if (tz) event.timezone = tz
      event.alarms = alarms
      event.attendees = attendees
      event.attachments = attachments
      events.push(event)
    }
    i++
  }

  return { meta, timezones, events }
}

export async function parseICSFile(file: File): Promise<ParsedCalendar> {
  const text = await file.text()
  return parseICS(text)
}
