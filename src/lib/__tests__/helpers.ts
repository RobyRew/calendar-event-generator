import ICAL from 'ical.js'
import type { CalendarEvent } from '@/types'
import { normalizeEvent } from '@/lib/normalize'
import { fromWall } from '@/lib/time'

export const FIXED = '2026-10-01T08:00:00.000Z'

/** A normalised event with deterministic ids and revision times. */
export function ev(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return normalizeEvent({
    uid: 'TEST-UID-1',
    summary: 'Test event',
    timezone: 'Europe/Bucharest',
    startDate: wall('2026-10-15T10:00', overrides.timezone ?? 'Europe/Bucharest'),
    endDate: wall('2026-10-15T11:00', overrides.timezone ?? 'Europe/Bucharest'),
    created: FIXED,
    lastModified: FIXED,
    dtstamp: FIXED,
    alarms: [],
    ...overrides,
  })
}

/** Instant for "yyyy-MM-ddTHH:mm" wall time in a zone. */
export function wall(local: string, tz: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)!
  return fromWall({ year: +m[1]!, month: +m[2]!, day: +m[3]!, hour: +m[4]!, minute: +m[5]!, second: 0 }, tz)
}

/** Parse with Mozilla's ical.js (independent oracle) and register embedded VTIMEZONEs. */
export function oracle(ics: string) {
  const root = new ICAL.Component(ICAL.parse(ics))
  for (const vtz of root.getAllSubcomponents('vtimezone')) {
    ICAL.TimezoneService.register(new ICAL.Timezone(vtz))
  }
  const events = root.getAllSubcomponents('vevent').map((c) => new ICAL.Event(c))
  return { root, events }
}

export function lines(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, '').split('\r\n')
}

/** First line with this prefix inside a VEVENT (VTIMEZONE blocks also carry DTSTART/RRULE). */
export function line(ics: string, prefix: string): string | undefined {
  const all = lines(ics)
  const start = all.indexOf('BEGIN:VEVENT')
  return all.slice(start === -1 ? 0 : start).find((l) => l.startsWith(prefix))
}
