import type { CalendarEvent, CalendarMeta, RecurrenceRule, TimezoneDefinition } from '@/types'
import { PROD_ID, APP_VERSION } from './constants'

function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let start = 0
  let isFirst = true
  while (start < bytes.length) {
    const chunkSize = isFirst ? 75 : 74
    let end = Math.min(start + chunkSize, bytes.length)
    if (end < bytes.length) {
      while (end > start && (bytes[end]! & 0xC0) === 0x80) {
        end--
      }
    }
    const chunk = new TextDecoder().decode(bytes.slice(start, end))
    parts.push(isFirst ? chunk : ' ' + chunk)
    start = end
    isFirst = false
  }
  return parts.join('\r\n')
}

function getTimezoneOffsetString(tz: string, date: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, timeZoneName: 'longOffset',
    })
    const parts = fmt.formatToParts(date)
    const tzPart = parts.find((p) => p.type === 'timeZoneName')
    if (tzPart) {
      const m = tzPart.value.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
      if (m) {
        const sign = m[1]![0]!
        const hrs = m[1]!.replace(/[+-]/, '').padStart(2, '0')
        const mins = (m[2] || '00').padStart(2, '0')
        return `${sign}${hrs}${mins}`
      }
      if (tzPart.value === 'GMT') return '+0000'
    }
  } catch { /* fall through */ }
  return '+0000'
}

function buildTimezoneBlock(tz: string, emit: (line: string) => void, tzDefs?: TimezoneDefinition[]) {
  const imported = tzDefs?.find((d) => d.tzid === tz)
  emit('BEGIN:VTIMEZONE')
  emit(`TZID:${tz}`)
  if (imported?.standard) {
    emit('BEGIN:STANDARD')
    emit(`DTSTART:${imported.standard.dtstart}`)
    if (imported.standard.rrule) emit(`RRULE:${imported.standard.rrule}`)
    emit(`TZNAME:${imported.standard.tzname}`)
    emit(`TZOFFSETFROM:${imported.standard.tzoffsetfrom}`)
    emit(`TZOFFSETTO:${imported.standard.tzoffsetto}`)
    emit('END:STANDARD')
  } else {
    const jan = new Date(2024, 0, 15)
    const stdOffset = getTimezoneOffsetString(tz, jan)
    emit('BEGIN:STANDARD')
    emit('DTSTART:19701101T030000')
    emit('RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10')
    emit(`TZNAME:${tz}`)
    const jul = new Date(2024, 6, 15)
    const dstOffset = getTimezoneOffsetString(tz, jul)
    emit(`TZOFFSETFROM:${dstOffset}`)
    emit(`TZOFFSETTO:${stdOffset}`)
    emit('END:STANDARD')
  }
  if (imported?.daylight) {
    emit('BEGIN:DAYLIGHT')
    emit(`DTSTART:${imported.daylight.dtstart}`)
    if (imported.daylight.rrule) emit(`RRULE:${imported.daylight.rrule}`)
    emit(`TZNAME:${imported.daylight.tzname}`)
    emit(`TZOFFSETFROM:${imported.daylight.tzoffsetfrom}`)
    emit(`TZOFFSETTO:${imported.daylight.tzoffsetto}`)
    emit('END:DAYLIGHT')
  } else {
    const jan = new Date(2024, 0, 15)
    const stdOffset = getTimezoneOffsetString(tz, jan)
    const jul = new Date(2024, 6, 15)
    const dstOffset = getTimezoneOffsetString(tz, jul)
    if (stdOffset !== dstOffset) {
      emit('BEGIN:DAYLIGHT')
      emit('DTSTART:19700329T020000')
      emit('RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3')
      emit(`TZNAME:${tz}`)
      emit(`TZOFFSETFROM:${stdOffset}`)
      emit(`TZOFFSETTO:${dstOffset}`)
      emit('END:DAYLIGHT')
    }
  }
  emit('END:VTIMEZONE')
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function formatDateUTC(iso: string): string {
  const d = new Date(iso)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  const s = String(d.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${day}T${h}${min}${s}Z`
}

function formatDateLocal(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}${m}${day}T${h}${min}${s}`
}

function formatDateOnly(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function buildRRule(rule: RecurrenceRule): string {
  const parts: string[] = [`FREQ=${rule.frequency}`]
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`)
  if (rule.count !== undefined) parts.push(`COUNT=${rule.count}`)
  if (rule.until) parts.push(`UNTIL=${formatDateOnly(rule.until)}`)
  if (rule.byDay?.length) parts.push(`BYDAY=${rule.byDay.join(',')}`)
  if (rule.byMonthDay?.length) parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`)
  if (rule.byMonth?.length) parts.push(`BYMONTH=${rule.byMonth.join(',')}`)
  if (rule.bySetPos?.length) parts.push(`BYSETPOS=${rule.bySetPos.join(',')}`)
  if (rule.weekStart) parts.push(`WKST=${rule.weekStart}`)
  return parts.join(';')
}

interface GeneratorOptions {
  includeAppleExtensions?: boolean
  includeGoogleExtensions?: boolean
  includeMicrosoftExtensions?: boolean
  stripPersonalData?: boolean
  method?: string
  timezones?: TimezoneDefinition[]
}

export function generateICS(events: CalendarEvent[], options: GeneratorOptions = {}): string {
  const { includeAppleExtensions = true, includeGoogleExtensions = true, includeMicrosoftExtensions = true, method, timezones: tzDefs } = options
  const lines: string[] = []

  const emit = (line: string) => lines.push(foldLine(line))

  emit('BEGIN:VCALENDAR')
  emit(`PRODID:${PROD_ID}`)
  emit(`VERSION:2.0`)
  emit('CALSCALE:GREGORIAN')
  if (method) emit(`METHOD:${method}`)
  emit(`X-WR-CALNAME:Calendar Event Generator v${APP_VERSION}`)

  // Collect unique timezones
  const tzIds = new Set<string>()
  for (const event of events) {
    if (event.timezone && event.timezone !== 'UTC') tzIds.add(event.timezone)
  }
  for (const tz of tzIds) {
    buildTimezoneBlock(tz, emit, tzDefs)
  }

  for (const event of events) {
    emit('BEGIN:VEVENT')
    emit(`UID:${event.uid}`)
    emit(`DTSTAMP:${formatDateUTC(event.dtstamp || new Date().toISOString())}`)

    if (event.allDay) {
      emit(`DTSTART;VALUE=DATE:${formatDateOnly(event.startDate)}`)
      emit(`DTEND;VALUE=DATE:${formatDateOnly(event.endDate)}`)
    } else if (event.timezone && event.timezone !== 'UTC') {
      emit(`DTSTART;TZID=${event.timezone}:${formatDateLocal(event.startDate)}`)
      emit(`DTEND;TZID=${event.timezone}:${formatDateLocal(event.endDate)}`)
    } else {
      emit(`DTSTART:${formatDateUTC(event.startDate)}`)
      emit(`DTEND:${formatDateUTC(event.endDate)}`)
    }

    emit(`SUMMARY:${escapeText(event.summary)}`)

    if (event.description) emit(`DESCRIPTION:${escapeText(event.description)}`)
    if (event.comment) emit(`COMMENT:${escapeText(event.comment)}`)
    if (event.created) emit(`CREATED:${formatDateUTC(event.created)}`)
    if (event.lastModified) emit(`LAST-MODIFIED:${formatDateUTC(event.lastModified)}`)
    if (event.sequence > 0) emit(`SEQUENCE:${event.sequence}`)
    if (event.status !== 'CONFIRMED') emit(`STATUS:${event.status}`)
    if (event.classification !== 'PUBLIC') emit(`CLASS:${event.classification}`)
    emit(`TRANSP:${event.transparency}`)

    if (event.url) emit(`URL;VALUE=URI:${event.url}`)
    if (event.priority > 0) emit(`PRIORITY:${event.priority}`)
    if (event.categories.length > 0) emit(`CATEGORIES:${event.categories.map(escapeText).join(',')}`)
    if (event.color) emit(`COLOR:${event.color}`)
    if (event.contact) emit(`CONTACT:${escapeText(event.contact)}`)
    if (event.relatedTo) emit(`RELATED-TO:${event.relatedTo}`)
    if (event.resources.length > 0) emit(`RESOURCES:${event.resources.map(escapeText).join(',')}`)
    if (event.recurrenceId) emit(`RECURRENCE-ID:${event.recurrenceId}`)

    // Location
    if (event.location) {
      emit(`LOCATION:${escapeText(event.location.text)}`)
      if (event.location.geo) {
        emit(`GEO:${event.location.geo.latitude};${event.location.geo.longitude}`)
      }
      const hasAppleLocation = event.location.appleAddress || event.location.appleTitle || event.location.appleMapItemHandle || event.location.appleRadius || event.location.geo
      if (includeAppleExtensions && hasAppleLocation) {
        const parts = [`VALUE=URI`]
        if (event.location.appleMapItemHandle) parts.push(`X-APPLE-MAPKIT-HANDLE=${event.location.appleMapItemHandle.replace(/\s/g, '')}`)
        if (event.location.appleRadius) parts.push(`X-APPLE-RADIUS=${event.location.appleRadius}`)
        parts.push(`X-APPLE-REFERENCEFRAME=1`)
        if (event.location.appleAddress) parts.push(`X-ADDRESS="${event.location.appleAddress}"`)
        if (event.location.appleTitle) parts.push(`X-TITLE="${event.location.appleTitle}"`)
        const geo = event.location.geo ? `geo:${event.location.geo.latitude},${event.location.geo.longitude}` : ''
        emit(`X-APPLE-STRUCTURED-LOCATION;${parts.join(';')}:${geo}`)
      }
    }

    // Organizer
    if (event.organizer) {
      const parts = []
      if (event.organizer.name) parts.push(`CN="${event.organizer.name}"`)
      if (event.organizer.email) parts.push(`EMAIL="${event.organizer.email}"`)
      emit(`ORGANIZER;${parts.join(';')}:mailto:${event.organizer.email}`)
    }

    // Attendees
    for (const att of event.attendees) {
      const parts = []
      if (att.name) parts.push(`CN="${att.name}"`)
      parts.push(`CUTYPE=${att.type}`)
      if (att.email) parts.push(`EMAIL="${att.email}"`)
      parts.push(`PARTSTAT=${att.status}`)
      parts.push(`ROLE=${att.role}`)
      if (att.rsvp) parts.push('RSVP=TRUE')
      emit(`ATTENDEE;${parts.join(';')}:mailto:${att.email}`)
    }

    // Recurrence
    if (event.recurrenceRule) {
      emit(`RRULE:${buildRRule(event.recurrenceRule)}`)
    }
    for (const exDate of event.recurrenceExceptions) {
      if (event.allDay) {
        emit(`EXDATE;VALUE=DATE:${formatDateOnly(exDate)}`)
      } else {
        emit(`EXDATE:${formatDateUTC(exDate)}`)
      }
    }

    // Attachments
    for (const attachment of event.attachments) {
      const parts = []
      if (attachment.mimeType) parts.push(`FMTTYPE="${attachment.mimeType}"`)
      if (attachment.size) parts.push(`SIZE=${attachment.size}`)
      parts.push('VALUE=URI')
      emit(`ATTACH;${parts.join(';')}:${attachment.uri}`)
    }

    // Alarms
    for (const alarm of event.alarms) {
      emit('BEGIN:VALARM')
      emit(`ACTION:${alarm.action}`)
      emit(`TRIGGER:${alarm.trigger}`)
      if (alarm.description) emit(`DESCRIPTION:${escapeText(alarm.description)}`)
      if (alarm.summary) emit(`SUMMARY:${escapeText(alarm.summary)}`)
      if (alarm.repeat && alarm.repeat > 0) emit(`REPEAT:${alarm.repeat}`)
      if (alarm.duration) emit(`DURATION:${alarm.duration}`)
      if (alarm.uid) emit(`UID:${alarm.uid}`)
      if (alarm.action === 'AUDIO' && alarm.attachUri) {
        emit(`ATTACH;VALUE=URI:${alarm.attachUri}`)
      }
      if (alarm.acknowledged) emit(`ACKNOWLEDGED:${formatDateUTC(alarm.acknowledged)}`)
      if (includeAppleExtensions) {
        if (alarm.isDefault) emit('X-APPLE-DEFAULT-ALARM:TRUE')
        if (alarm.uid) emit(`X-WR-ALARMUID:${alarm.uid}`)
      }
      emit('END:VALARM')
    }

    // Apple extensions
    if (includeAppleExtensions && event.apple) {
      if (event.apple.creatorIdentity) emit(`X-APPLE-CREATOR-IDENTITY:${event.apple.creatorIdentity}`)
      if (event.apple.creatorTeamIdentity) emit(`X-APPLE-CREATOR-TEAM-IDENTITY:${event.apple.creatorTeamIdentity}`)
      if (event.apple.travelAdvisory) emit(`X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:${event.apple.travelAdvisory}`)
      if (event.apple.structuredData) emit(`X-APPLE-STRUCTURED-DATA:${event.apple.structuredData}`)
    }

    // Google extensions
    if (includeGoogleExtensions && event.google) {
      if (event.google.conferenceUrl) emit(`X-GOOGLE-CONFERENCE:${event.google.conferenceUrl}`)
    }

    // Microsoft extensions
    if (includeMicrosoftExtensions && event.microsoft) {
      if (event.microsoft.busyStatus) emit(`X-MICROSOFT-CDO-BUSYSTATUS:${event.microsoft.busyStatus}`)
      if (event.microsoft.importance) emit(`X-MICROSOFT-CDO-IMPORTANCE:${event.microsoft.importance}`)
      if (event.microsoft.ownerApptId) emit(`X-MICROSOFT-CDO-OWNERAPPTID:${event.microsoft.ownerApptId}`)
    }

    emit('END:VEVENT')
  }

  emit('END:VCALENDAR')
  return lines.join('\r\n')
}

export function generateSingleEventICS(event: CalendarEvent, options?: GeneratorOptions): string {
  return generateICS([event], options)
}

export function generateCalendarMeta(): CalendarMeta {
  return {
    prodId: PROD_ID,
    version: '2.0',
    calscale: 'GREGORIAN',
  }
}
