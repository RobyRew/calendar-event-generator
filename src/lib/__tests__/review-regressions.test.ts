import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '@/types'
import { generateICS } from '@/lib/ics-generator'
import { parseICS } from '@/lib/ics-parser'
import { normalizeEvent } from '@/lib/normalize'
import { reanchorRecurrence } from '@/lib/recurrence-edit'
import { addDaysIn } from '@/lib/time'
import { windowsZoneToIana } from '@/lib/windows-zones'
import { ev, lines, line, oracle, wall } from './helpers'

// Regression tests for the pre-push review findings (2026-10-16).

const cal = (...body: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...body, 'END:VCALENDAR'].join('\r\n')

/** Occurrence instants (ISO) of the first recurring VEVENT, expanded by ical.js using the file's own VTIMEZONEs. */
function expand(ics: string, max = 12): string[] {
  const { root, events } = oracle(ics)
  const masters = events.filter((e) => !e.isRecurrenceException())
  const master = masters.find((e) => e.isRecurring()) ?? masters[0]!
  for (const vev of root.getAllSubcomponents('vevent')) if (vev.hasProperty('recurrence-id')) master.relateException(vev)
  const it = master.iterator()
  const out: string[] = []
  for (let n = it.next(); n && out.length < max; n = it.next()) {
    const d = master.getOccurrenceDetails(n)
    if ((d.item.component.getFirstPropertyValue('status') as string | null) === 'CANCELLED') continue
    out.push(d.startDate.toJSDate().toISOString())
  }
  return out
}

describe('no line injection through stored values', () => {
  it('normalizeEvent keeps only listed enum values', () => {
    const e = normalizeEvent({
      status: 'TENTATIVE\r\nEND:VEVENT\r\nBEGIN:VEVENT' as never,
      classification: 'X' as never,
      transparency: 'transparent' as never,
      recurrenceRule: { frequency: 'DAILY\r\nX-INJ:1' as never, interval: 1 },
      attendees: [{ name: 'a', email: 'a@x.test', role: 'CHAIR\nX' as never, status: 'ACCEPTED', type: 'INDIVIDUAL', rsvp: false }],
    })
    expect(e.status).toBe('CONFIRMED')
    expect(e.classification).toBe('PUBLIC')
    expect(e.transparency).toBe('TRANSPARENT')
    expect(e.recurrenceRule).toBeNull()
    expect(e.attendees[0]!.role).toBe('REQ-PARTICIPANT')
    const weekly = normalizeEvent({ recurrenceRule: { frequency: 'weekly' as never, interval: 1, byDay: ['MO', 'TU\r\nX:1' as never, '-1FR'], weekStart: 'XX' as never } })
    expect(weekly.recurrenceRule).toMatchObject({ frequency: 'WEEKLY', byDay: ['MO', '-1FR'] })
    expect(weekly.recurrenceRule?.weekStart).toBeUndefined()
  })

  it('the generator never emits a raw line break, even from a value that skipped normalisation', () => {
    const raw = { ...ev(), status: 'TENTATIVE\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:forged' } as unknown as CalendarEvent
    const ics = generateICS([raw])
    const all = lines(ics)
    expect(all.some((l) => l.startsWith('UID:forged'))).toBe(false)
    expect(all.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1)
    expect(oracle(ics).events).toHaveLength(1)
  })

  it('RFC 6868 newlines in imported parameters are re-encoded, not re-emitted raw', () => {
    const { events } = parseICS(cal(
      'BEGIN:VEVENT', 'UID:p', 'DTSTART:20261015T100000Z', 'SUMMARY:Original',
      `X-APPLE-STRUCTURED-DATA;VALUE=URI;X-APPLE-TYPE="a^nEND:VEVENT^nBEGIN:VEVENT^nUID:injected":foo`,
      `ATTENDEE;ROLE="REQ-PARTICIPANT^nURL:HTTPS://EVIL.TEST/X":mailto:a@x.test`,
      'END:VEVENT',
    ), { defaultTimezone: 'UTC' })
    const out = generateICS(events)
    expect(out).not.toMatch(/[^\r]\n/)
    expect(parseICS(out).events.map((e) => e.uid)).toEqual(['p'])
    expect(() => oracle(out)).not.toThrow()
  })
})

describe('time zones on import', () => {
  it('maps Windows zone names to IANA zones', () => {
    expect(windowsZoneToIana('India Standard Time')).toBe('Asia/Calcutta')
    expect(windowsZoneToIana('gtb standard time')).toBe('Europe/Bucharest')
    expect(windowsZoneToIana('(UTC+02:00) Athens, Bucharest')).toBeNull()
  })

  it('a weekly Outlook series keeps the organiser\'s DST rules across a change', () => {
    const src = cal(
      'BEGIN:VTIMEZONE', 'TZID:Eastern Standard Time',
      'BEGIN:STANDARD', 'DTSTART:16010101T020000', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11', 'END:STANDARD',
      'BEGIN:DAYLIGHT', 'DTSTART:16010101T020000', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3', 'END:DAYLIGHT',
      'END:VTIMEZONE',
      'BEGIN:VEVENT', 'UID:ost', 'DTSTAMP:20261001T000000Z', 'DTSTART;TZID=Eastern Standard Time:20261015T100000', 'DTEND;TZID=Eastern Standard Time:20261015T110000',
      'RRULE:FREQ=WEEKLY;COUNT=6', 'END:VEVENT',
    )
    for (const host of ['Europe/Bucharest', 'UTC', 'Asia/Calcutta']) {
      const [e] = parseICS(src, { defaultTimezone: host }).events
      expect(e!.timezone).toBe('America/New_York')
      expect(expand(generateICS([e!]))).toEqual(expand(src))
    }
  })

  it('a UTC-anchored series stays UTC, so occurrences and EXDATEs keep matching', () => {
    const src = cal('BEGIN:VEVENT', 'UID:u', 'DTSTAMP:20261001T000000Z', 'DTSTART:20261015T070000Z', 'DTEND:20261015T080000Z',
      'RRULE:FREQ=WEEKLY;COUNT=4', 'EXDATE:20261105T070000Z', 'END:VEVENT')
    const [e] = parseICS(src, { defaultTimezone: 'Europe/Bucharest' }).events
    expect(e!.timezone).toBe('UTC')
    const out = generateICS([e!])
    expect(line(out, 'DTSTART')).toBe('DTSTART:20261015T070000Z')
    expect(expand(out)).toEqual(['2026-10-15T07:00:00.000Z', '2026-10-22T07:00:00.000Z', '2026-10-29T07:00:00.000Z'])
    // A one-off UTC event still takes the user's zone for display.
    const [single] = parseICS(cal('BEGIN:VEVENT', 'UID:s', 'DTSTART:20261015T070000Z', 'END:VEVENT'), { defaultTimezone: 'Europe/Bucharest' }).events
    expect(single!.timezone).toBe('Europe/Bucharest')
  })

  it('DURATION day parts are nominal across a DST change', () => {
    const [e] = parseICS(cal('BEGIN:VEVENT', 'UID:d', 'DTSTART;TZID=Europe/Bucharest:20261024T100000', 'DURATION:P1DT1H', 'END:VEVENT'), { defaultTimezone: 'UTC' }).events
    expect(line(generateICS([e!]), 'DTEND')).toBe('DTEND;TZID=Europe/Bucharest:20261025T110000')
  })

  it('drops ACTION:NONE alarms instead of turning them into reminders', () => {
    const [e] = parseICS(cal('BEGIN:VEVENT', 'UID:n', 'DTSTART:20261015T100000Z',
      'BEGIN:VALARM', 'ACTION:NONE', 'TRIGGER;VALUE=DATE-TIME:19760401T005545Z', 'X-APPLE-DEFAULT-ALARM:TRUE', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT10M', 'DESCRIPTION:x', 'END:VALARM',
      'END:VEVENT'), { defaultTimezone: 'UTC' }).events
    expect(e!.alarms).toHaveLength(1)
    expect(generateICS([e!]).match(/BEGIN:VALARM/g)).toHaveLength(1)
  })
})

describe('recurrence exceptions and overrides', () => {
  const tz = 'Europe/Bucharest'
  const master = () => ev({ uid: 'S', timezone: tz, startDate: wall('2026-10-15T10:00', tz), endDate: wall('2026-10-15T11:00', tz), recurrenceRule: { frequency: 'WEEKLY', interval: 1, count: 3 } })

  it('busy feeds turn a cancelled or free override into an EXDATE on its master', () => {
    const cancelled = ev({ uid: 'S', timezone: tz, startDate: wall('2026-10-22T10:00', tz), endDate: wall('2026-10-22T11:00', tz), recurrenceId: wall('2026-10-22T10:00', tz), status: 'CANCELLED' })
    const free = ev({ uid: 'S', timezone: tz, startDate: wall('2026-10-29T15:00', tz), endDate: wall('2026-10-29T16:00', tz), recurrenceId: wall('2026-10-29T10:00', tz), transparency: 'TRANSPARENT' })
    const busy = generateICS([master(), cancelled, free], { redactLevel: 'busy' })
    expect(busy.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(expand(busy)).toEqual([wall('2026-10-15T10:00', tz)])
  })

  it('busy feeds leave out the overrides of a cancelled master', () => {
    const m = { ...master(), status: 'CANCELLED' as const }
    const moved = ev({ uid: 'S', timezone: tz, startDate: wall('2026-10-22T12:00', tz), endDate: wall('2026-10-22T13:00', tz), recurrenceId: wall('2026-10-22T10:00', tz) })
    expect(generateICS([m, moved], { redactLevel: 'busy' })).not.toContain('BEGIN:VEVENT')
  })

  it('RECURRENCE-ID uses the master\'s value type for an override changed to all-day', () => {
    const src = cal(
      'BEGIN:VEVENT', 'UID:R', 'DTSTAMP:20261001T000000Z', 'DTSTART;TZID=Europe/Bucharest:20261015T100000', 'DTEND;TZID=Europe/Bucharest:20261015T110000', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Weekly', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:R', 'DTSTAMP:20261001T000000Z', 'RECURRENCE-ID;TZID=Europe/Bucharest:20261022T100000', 'DTSTART;VALUE=DATE:20261022', 'SUMMARY:Offsite day', 'END:VEVENT',
    )
    const out = generateICS(parseICS(src, { defaultTimezone: 'UTC' }).events)
    expect(lines(out)).toContain('RECURRENCE-ID;TZID=Europe/Bucharest:20261022T100000')
    expect(expand(out)).toEqual(expand(src))
  })

  it('moving the start or toggling all-day keeps exceptions and UNTIL on their days', () => {
    const e = { ...master(), recurrenceRule: { frequency: 'WEEKLY' as const, interval: 1, until: wall('2026-11-30T23:59', tz) }, recurrenceExceptions: [wall('2026-11-05T10:00', tz)] }
    const moved = reanchorRecurrence(e, wall('2026-10-15T11:00', tz), false, tz)
    expect(moved.recurrenceExceptions).toEqual([wall('2026-11-05T11:00', tz)])
    const allDay = reanchorRecurrence(e, wall('2026-10-15T00:00', tz), true, tz)
    expect(allDay.recurrenceExceptions).toEqual([wall('2026-11-05T00:00', tz)])
    expect(allDay.recurrenceRule?.until).toBe(wall('2026-11-30T00:00', tz))
    const timed = reanchorRecurrence({ ...e, recurrenceRule: { ...e.recurrenceRule, until: wall('2026-11-30T00:00', tz) } }, wall('2026-10-15T09:00', tz), false, tz)
    expect(Date.parse(timed.recurrenceRule!.until!)).toBe(Date.parse(wall('2026-11-30T23:59', tz)) + 59_000)
    // The generated EXDATE then matches an occurrence again.
    const out = generateICS([{ ...e, startDate: wall('2026-10-15T11:00', tz), endDate: wall('2026-10-15T12:00', tz), ...moved }])
    expect(expand(out, 30)).not.toContain(wall('2026-11-05T11:00', tz))
  })
})

describe('embedded VTIMEZONE agrees with the instants', () => {
  const zones = ['Africa/Casablanca', 'Africa/El_Aaiun', 'America/Vancouver', 'America/Edmonton', 'Asia/Gaza', 'Asia/Hebron', 'Europe/Bucharest', 'America/New_York', 'Australia/Sydney', 'Pacific/Auckland', 'Asia/Calcutta', 'America/Sao_Paulo']
  for (const tz of zones) {
    it(`weekly series in ${tz} expands to the stored instants`, () => {
      const start = wall('2026-01-15T10:00', tz)
      const e = ev({ uid: tz, timezone: tz, startDate: start, endDate: new Date(Date.parse(start) + 3600_000).toISOString(), recurrenceRule: { frequency: 'WEEKLY', interval: 1, count: 60 } })
      const got = expand(generateICS([e]), 60)
      const want = Array.from({ length: 60 }, (_, i) => addDaysIn(start, i * 7, tz))
      expect(got).toEqual(want)
    })
  }

  // Second review: the block built from Intl stopped at start + 6 years and had no
  // RRULE, so a series that began years ago drifted an hour for current dates.
  const year = new Date().getUTCFullYear()
  const longRunning: [string, string][] = [
    ['America/New_York', '2005-03-17T10:00'],
    ['America/Vancouver', '2015-03-05T10:00'],
    ['America/Edmonton', '2018-01-11T10:00'],
    ['Africa/Casablanca', '2020-01-09T10:00'],
    ['Australia/Sydney', '2006-02-02T10:00'],
    ['Africa/Cairo', '2020-01-09T10:00'],
    ['Asia/Jerusalem', '2010-01-07T10:00'],
  ]
  for (const [tz, local] of longRunning) {
    it(`open-ended weekly series in ${tz} from ${local.slice(0, 4)} keeps current and later occurrences on time`, () => {
      const start = wall(local, tz)
      const e = ev({ uid: tz, timezone: tz, startDate: start, endDate: new Date(Date.parse(start) + 3600_000).toISOString(), recurrenceRule: { frequency: 'WEEKLY', interval: 1 } })
      const from = Date.UTC(year, 0, 1)
      const to = Date.UTC(year + 12, 0, 1)
      const all = expand(generateICS([e]), 2600)
      const got = all.filter((x) => Date.parse(x) >= from && Date.parse(x) < to)
      const want: string[] = []
      for (let i = 0; ; i++) {
        const t = addDaysIn(start, i * 7, tz)
        if (Date.parse(t) >= to) break
        if (Date.parse(t) >= from) want.push(t)
      }
      expect(got.length).toBeGreaterThan(500)
      expect(got).toEqual(want)
    })
  }

  it('a 1965 event and a 2026 event in one zone are both placed at their instants', () => {
    const tz = 'Europe/Bucharest'
    const old = ev({ uid: 'old', timezone: tz, startDate: wall('1965-06-10T10:00', tz), endDate: wall('1965-06-10T11:00', tz) })
    const now = ev({ uid: 'now', timezone: tz, startDate: wall('2026-07-02T10:00', tz), endDate: wall('2026-07-02T11:00', tz) })
    const { events } = oracle(generateICS([old, now]))
    const start = (uid: string) => events.find((e) => e.uid === uid)!.startDate.toJSDate().toISOString()
    expect(start('now')).toBe(wall('2026-07-02T10:00', tz))
    expect(start('old')).toBe(wall('1965-06-10T10:00', tz))
  })

  it('a calendar with hundreds of long series in one zone still exports', () => {
    const tz = 'America/Vancouver'
    const list = Array.from({ length: 600 }, (_, i) => {
      const start = wall(`${1400 + i * 5}-01-05T10:00`, tz)
      return ev({ uid: `s${i}`, timezone: tz, startDate: start, endDate: new Date(Date.parse(start) + 3600_000).toISOString(), recurrenceRule: { frequency: 'WEEKLY', interval: 1, until: wall(`${1404 + i * 5}-12-01T10:00`, tz) } })
    })
    expect(() => generateICS(list)).not.toThrow()
  })
})

describe('second review (2026-10-17)', () => {
  const tz = 'Europe/Bucharest'

  it('busy feeds keep a busy occurrence of a free series', () => {
    const m = ev({ uid: 'F', timezone: tz, startDate: wall('2026-10-15T10:00', tz), endDate: wall('2026-10-15T11:00', tz), transparency: 'TRANSPARENT', recurrenceRule: { frequency: 'WEEKLY', interval: 1, count: 4 } })
    const busy = ev({ uid: 'F', timezone: tz, startDate: wall('2026-10-22T12:00', tz), endDate: wall('2026-10-22T14:00', tz), recurrenceId: wall('2026-10-22T10:00', tz), transparency: 'OPAQUE' })
    const out = generateICS([m, busy], { redactLevel: 'busy' })
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(lines(out)).toContain('TRANSP:OPAQUE')
    expect(line(out, 'DTSTART')).toContain('20261022T120000')
  })

  for (const host of ['America/New_York', 'UTC', 'Asia/Tokyo']) {
    it(`a timed override of an all-day series keeps its RECURRENCE-ID day (import zone ${host})`, () => {
      const src = cal(
        'BEGIN:VEVENT', 'UID:AD', 'DTSTAMP:20261001T000000Z', 'DTSTART;VALUE=DATE:20261015', 'DTEND;VALUE=DATE:20261016', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Day', 'END:VEVENT',
        'BEGIN:VEVENT', 'UID:AD', 'DTSTAMP:20261001T000000Z', 'RECURRENCE-ID;VALUE=DATE:20261022', 'DTSTART;TZID=Europe/Bucharest:20261022T100000', 'DTEND;TZID=Europe/Bucharest:20261022T110000', 'SUMMARY:Moved', 'END:VEVENT',
      )
      const out = generateICS(parseICS(src, { defaultTimezone: host }).events)
      expect(lines(out)).toContain('RECURRENCE-ID;VALUE=DATE:20261022')
    })
  }

  it('DURATION days on a UTC start are exact days', () => {
    const src = cal('BEGIN:VEVENT', 'UID:D1', 'DTSTAMP:20261001T000000Z', 'DTSTART:20261024T220000Z', 'DURATION:P1D', 'END:VEVENT')
    for (const host of ['Europe/Bucharest', 'America/New_York', 'UTC']) {
      expect(parseICS(src, { defaultTimezone: host }).events[0]!.endDate).toBe('2026-10-25T22:00:00.000Z')
    }
    const withCalZone = cal('X-WR-TIMEZONE:Europe/Bucharest', 'BEGIN:VEVENT', 'UID:D2', 'DTSTAMP:20261001T000000Z', 'DTSTART:20261024T220000Z', 'DURATION:P1D', 'END:VEVENT')
    expect(parseICS(withCalZone, { defaultTimezone: 'UTC' }).events[0]!.endDate).toBe('2026-10-25T22:00:00.000Z')
  })

  it('DURATION days on a VTIMEZONE-resolved start follow that VTIMEZONE, not the importer', () => {
    const src = cal(
      'BEGIN:VTIMEZONE', 'TZID:Custom Fixed', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0300', 'END:STANDARD', 'END:VTIMEZONE',
      'BEGIN:VEVENT', 'UID:D3', 'DTSTAMP:20261001T000000Z', 'DTSTART;TZID=Custom Fixed:20261031T180000', 'DURATION:P2D', 'END:VEVENT',
    )
    for (const host of ['America/New_York', 'Europe/Bucharest', 'UTC']) {
      const e = parseICS(src, { defaultTimezone: host }).events[0]!
      expect(e.startDate).toBe('2026-10-31T15:00:00.000Z')
      expect(e.endDate).toBe('2026-11-02T15:00:00.000Z')
    }
  })

  it('a TZID named like an Object.prototype member does not break the import', () => {
    for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) expect(windowsZoneToIana(name)).toBeNull()
    const src = cal(
      'BEGIN:VEVENT', 'UID:ok', 'DTSTAMP:20261001T000000Z', 'DTSTART:20261024T100000Z', 'DTEND:20261024T110000Z', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:odd', 'DTSTAMP:20261001T000000Z', 'DTSTART;TZID=constructor:20261024T100000', 'DTEND;TZID=constructor:20261024T110000', 'END:VEVENT',
    )
    expect(parseICS(src, { defaultTimezone: 'UTC' }).events.map((e) => e.uid).sort()).toEqual(['odd', 'ok'])
  })

  it('a date-only start move leaves EXDATE, RDATE and UNTIL alone', () => {
    const e = ev({ uid: 'B', timezone: tz, startDate: wall('2026-11-01T09:00', tz), endDate: wall('2026-11-01T10:00', tz), recurrenceRule: { frequency: 'DAILY', interval: 1, byHour: [9, 17], until: wall('2026-11-20T17:00', tz) }, recurrenceExceptions: [wall('2026-11-04T17:00', tz)], recurrenceDates: [wall('2026-11-05T14:00', tz)] })
    const moved = reanchorRecurrence(e, wall('2026-11-02T09:00', tz), false, tz)
    expect(moved.recurrenceExceptions).toEqual(e.recurrenceExceptions)
    expect(moved.recurrenceDates).toEqual(e.recurrenceDates)
    expect(moved.recurrenceRule).toEqual(e.recurrenceRule)
  })

  it('a time change moves only the entries at the old start time', () => {
    const e = ev({ uid: 'B', timezone: tz, startDate: wall('2026-11-01T09:00', tz), endDate: wall('2026-11-01T10:00', tz), recurrenceRule: { frequency: 'DAILY', interval: 1, byHour: [9, 17] }, recurrenceExceptions: [wall('2026-11-03T09:00', tz), wall('2026-11-04T17:00', tz)], recurrenceDates: [wall('2026-11-05T14:00', tz)] })
    const moved = reanchorRecurrence(e, wall('2026-11-01T09:30', tz), false, tz)
    expect(moved.recurrenceExceptions).toEqual([wall('2026-11-03T09:30', tz), wall('2026-11-04T17:00', tz)])
    expect(moved.recurrenceDates).toEqual([wall('2026-11-05T14:00', tz)])
  })

  it('an hourly series keeps its exact UNTIL when the start time moves', () => {
    const until = '2026-11-02T13:00:00.000Z'
    const e = ev({ uid: 'H', timezone: tz, startDate: wall('2026-11-02T09:00', tz), endDate: wall('2026-11-02T09:30', tz), recurrenceRule: { frequency: 'HOURLY', interval: 1, until } })
    expect(reanchorRecurrence(e, wall('2026-11-02T09:30', tz), false, tz).recurrenceRule?.until).toBe(until)
  })

  it('a non-string Apple travel advisory is dropped, not thrown on', () => {
    for (const bad of [true, 3, {}, []]) {
      expect(normalizeEvent({ apple: { travelAdvisory: bad as never } }).apple.travelAdvisory).toBeUndefined()
    }
    expect(normalizeEvent({ apple: { travelAdvisory: 'enabled' as never } }).apple.travelAdvisory).toBe('ENABLED')
  })
})
