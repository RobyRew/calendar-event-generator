import { describe, expect, it } from 'vitest'
import { generateICS } from '@/lib/ics-generator'
import { minutesToTrigger } from '@/lib/utils'
import { ev, FIXED, line, lines, oracle, wall } from './helpers'

describe('calendar envelope', () => {
  it('writes VERSION, PRODID, CALSCALE and ends with CRLF', () => {
    const ics = generateICS([ev()], { now: FIXED })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).not.toMatch(/[^\r]\n/)
  })

  it('only ever writes METHOD:PUBLISH', () => {
    expect(generateICS([ev()])).not.toContain('METHOD:')
    expect(generateICS([ev()], { method: 'PUBLISH' })).toContain('METHOD:PUBLISH\r\n')
    // @ts-expect-error REQUEST is not accepted
    expect(generateICS([ev()], { method: 'REQUEST' })).not.toContain('METHOD:REQUEST')
  })

  it('writes feed properties', () => {
    const ics = generateICS([ev()], {
      calendarName: 'Family, home',
      calendarDescription: 'Shared',
      calendarTimezone: 'Europe/Bucharest',
      calendarColor: '#007aff',
      refreshInterval: 'PT1H',
      sourceUrl: 'https://calendar.robyrew.com/feed/abc.ics',
    })
    expect(ics).toContain('NAME:Family\\, home\r\n')
    expect(ics).toContain('X-WR-CALNAME:Family\\, home\r\n')
    expect(ics).toContain('X-WR-CALDESC:Shared\r\n')
    expect(ics).toContain('X-WR-TIMEZONE:Europe/Bucharest\r\n')
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H\r\n')
    expect(ics).toContain('X-PUBLISHED-TTL:PT1H\r\n')
    expect(ics).toContain('X-APPLE-CALENDAR-COLOR:#007AFF\r\n')
    expect(line(ics, 'COLOR:')).toMatch(/^COLOR:[a-z]+$/)
    expect(ics).toContain('SOURCE;VALUE=URI:https://calendar.robyrew.com/feed/abc.ics\r\n')
  })
})

describe('folding and escaping', () => {
  it('folds at 75 octets without splitting UTF-8 sequences', () => {
    const summary = 'Întâlnire ședință 🎉 mañana — '.repeat(8)
    const ics = generateICS([ev({ summary })])
    for (const l of ics.split('\r\n')) {
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
      expect(l).not.toContain('\uFFFD')
    }
    expect(oracle(ics).events[0]!.summary).toBe(summary)
  })

  it('escapes TEXT so backslashes, commas, semicolons and newlines round-trip', () => {
    const description = 'C:\\new folder; a, b\nsecond line\r\nthird'
    const ics = generateICS([ev({ description })])
    expect(line(ics, 'DESCRIPTION:')).toBe('DESCRIPTION:C:\\\\new folder\\; a\\, b\\nsecond line\\nthird')
    expect(oracle(ics).events[0]!.description).toBe('C:\\new folder; a, b\nsecond line\nthird')
  })

  it('keeps line breaks out of non-text values', () => {
    const ics = generateICS([ev({ url: 'https://x.test/a\r\nX-INJECTED:1' })])
    expect(lines(ics).some((l) => l.startsWith('X-INJECTED'))).toBe(false)
  })
})

describe('times', () => {
  const zones = ['Europe/Bucharest', 'America/New_York', 'Australia/Sydney', 'Pacific/Auckland']

  for (const tz of zones) {
    for (const local of ['2026-01-15T10:00', '2026-03-10T10:00', '2026-04-06T10:00', '2026-07-15T10:00', '2026-10-27T10:00', '2026-11-02T10:00']) {
      it(`exports ${local} ${tz} as that wall time with a TZID (oracle agrees on the instant)`, () => {
        const start = wall(local, tz)
        const e = ev({ timezone: tz, startDate: start, endDate: new Date(new Date(start).getTime() + 3600_000).toISOString() })
        const ics = generateICS([e])
        expect(line(ics, 'DTSTART')).toBe(`DTSTART;TZID=${tz}:${local.replace(/[-:]/g, '')}00`)
        expect(ics).toContain(`BEGIN:VTIMEZONE\r\nTZID:${tz}\r\n`)
        expect(oracle(ics).events[0]!.startDate.toJSDate().toISOString()).toBe(start)
      })
    }
  }

  it('exports UTC events with Z and no VTIMEZONE', () => {
    const e = ev({ timezone: 'UTC', startDate: '2026-10-15T07:00:00.000Z', endDate: '2026-10-15T08:00:00.000Z' })
    const ics = generateICS([e])
    expect(line(ics, 'DTSTART')).toBe('DTSTART:20261015T070000Z')
    expect(ics).not.toContain('BEGIN:VTIMEZONE')
  })

  it('emits one VTIMEZONE per zone used by timed events only', () => {
    const ics = generateICS([
      ev({ uid: 'a' }),
      ev({ uid: 'b' }),
      ev({ uid: 'c', allDay: true, timezone: 'America/New_York' }),
    ])
    expect(ics.match(/BEGIN:VTIMEZONE/g)).toHaveLength(1)
    expect(ics).not.toContain('TZID:America/New_York')
  })

  it('exports all-day events as dates with an exclusive end, even if stored with end = start', () => {
    const start = wall('2026-10-15T00:00', 'Europe/Bucharest')
    const e = ev({ allDay: true, startDate: start, endDate: new Date(new Date(start).getTime() + 3600_000).toISOString() })
    const ics = generateICS([e])
    expect(line(ics, 'DTSTART')).toBe('DTSTART;VALUE=DATE:20261015')
    expect(line(ics, 'DTEND')).toBe('DTEND;VALUE=DATE:20261016')
    const o = oracle(ics).events[0]!
    expect(o.startDate.isDate).toBe(true)
    expect(o.endDate.toString()).toBe('2026-10-16')
  })
})

describe('recurrence', () => {
  const tz = 'America/New_York'
  const start = wall('2026-10-15T10:00', tz) // a Thursday

  it('writes UNTIL as a UTC date-time for timed events and never with COUNT', () => {
    const e = ev({
      timezone: tz, startDate: start, endDate: wall('2026-10-15T11:00', tz),
      recurrenceRule: { frequency: 'WEEKLY', interval: 1, byDay: ['TH'], count: 5, until: wall('2026-12-31T23:59', tz) },
    })
    const rrule = line(generateICS([e]), 'RRULE:')!
    expect(rrule).toMatch(/UNTIL=20270101T045900Z/)
    expect(rrule).not.toContain('COUNT=')
  })

  it('writes UNTIL as a date for all-day events', () => {
    const e = ev({
      allDay: true, timezone: tz, startDate: wall('2026-10-15T00:00', tz),
      recurrenceRule: { frequency: 'DAILY', interval: 1, until: wall('2026-10-20T00:00', tz) },
    })
    expect(line(generateICS([e]), 'RRULE:')).toBe('RRULE:FREQ=DAILY;UNTIL=20261020')
  })

  it('writes EXDATE in the DTSTART value type so it removes the occurrence', () => {
    const e = ev({
      timezone: tz, startDate: start, endDate: wall('2026-10-15T11:00', tz),
      recurrenceRule: { frequency: 'WEEKLY', interval: 1, count: 4 },
      recurrenceExceptions: [wall('2026-10-22T10:00', tz)],
    })
    const ics = generateICS([e])
    expect(line(ics, 'EXDATE')).toBe('EXDATE;TZID=America/New_York:20261022T100000')
    const it = oracle(ics).events[0]!.iterator()
    const seen: string[] = []
    for (let next = it.next(); next; next = it.next()) seen.push(next.toJSDate().toISOString())
    expect(seen).toHaveLength(3)
    expect(seen).not.toContain(wall('2026-10-22T10:00', tz))
  })

  it('writes RECURRENCE-ID with its zone', () => {
    const override = ev({ timezone: tz, startDate: wall('2026-10-29T12:00', tz), endDate: wall('2026-10-29T13:00', tz), recurrenceId: wall('2026-10-29T10:00', tz) })
    expect(line(generateICS([override]), 'RECURRENCE-ID')).toBe('RECURRENCE-ID;TZID=America/New_York:20261029T100000')
  })

  it('passes every BY* part through', () => {
    const e = ev({ recurrenceRule: { frequency: 'MONTHLY', interval: 2, byDay: ['2SU', '-1FR'], bySetPos: [1], byHour: [9], weekStart: 'MO' } })
    expect(line(generateICS([e]), 'RRULE:')).toBe('RRULE:FREQ=MONTHLY;INTERVAL=2;BYHOUR=9;BYDAY=2SU,-1FR;BYSETPOS=1;WKST=MO')
  })
})

describe('alarms', () => {
  it('builds day and week triggers before the T', () => {
    expect(minutesToTrigger(30)).toBe('-PT30M')
    expect(minutesToTrigger(60)).toBe('-PT1H')
    expect(minutesToTrigger(1440)).toBe('-P1D')
    expect(minutesToTrigger(2880)).toBe('-P2D')
    expect(minutesToTrigger(10080)).toBe('-P1W')
    expect(minutesToTrigger(0)).toBe('PT0S')
  })

  it('repairs the legacy -PT1D trigger', () => {
    const e = ev({ alarms: [{ uid: 'al', action: 'DISPLAY', trigger: '-PT1D', triggerRelation: 'START', description: '', isDefault: false }] })
    const ics = generateICS([e])
    expect(line(ics, 'TRIGGER')).toBe('TRIGGER:-P1D')
    expect(oracle(ics).root.getFirstSubcomponent('vevent')!.getFirstSubcomponent('valarm')!.getFirstPropertyValue('trigger')!.toString()).toBe('-P1D')
  })

  it('writes RELATED=END and absolute triggers', () => {
    const e = ev({
      alarms: [
        { uid: 'a', action: 'DISPLAY', trigger: '-PT5M', triggerRelation: 'END', description: 'x', isDefault: false },
        { uid: 'b', action: 'DISPLAY', trigger: '20261015T060000Z', triggerRelation: 'START', description: 'x', isDefault: false },
      ],
    })
    const l = lines(generateICS([e]))
    expect(l).toContain('TRIGGER;RELATED=END:-PT5M')
    expect(l).toContain('TRIGGER;VALUE=DATE-TIME:20261015T060000Z')
  })

  it('gives DISPLAY a DESCRIPTION, EMAIL its required parts, AUDIO no DESCRIPTION', () => {
    const base = { triggerRelation: 'START' as const, trigger: '-PT15M', isDefault: false }
    const withOrganizer = ev({
      summary: 'Standup',
      organizer: { name: 'Ana', email: 'ana@example.com' },
      alarms: [
        { ...base, uid: '1', action: 'DISPLAY', description: '' },
        { ...base, uid: '2', action: 'EMAIL', description: '' },
        { ...base, uid: '3', action: 'AUDIO', description: 'ignored', attachUri: 'Basso' },
      ],
    })
    const alarms = generateICS([withOrganizer]).split('BEGIN:VALARM').slice(1)
    expect(alarms[0]).toContain('DESCRIPTION:Standup')
    expect(alarms[1]).toContain('ACTION:EMAIL')
    expect(alarms[1]).toContain('SUMMARY:Standup')
    expect(alarms[1]).toContain('ATTENDEE:mailto:ana@example.com')
    expect(alarms[2]).not.toContain('DESCRIPTION')
    expect(alarms[2]).toContain('ATTACH;VALUE=URI:Basso')

    const noAddress = ev({ alarms: [{ ...base, uid: '4', action: 'EMAIL', description: 'x' }] })
    expect(generateICS([noAddress])).toContain('ACTION:DISPLAY')
  })

  it('can leave alarms out (feeds)', () => {
    const e = ev({ alarms: [{ uid: 'a', action: 'DISPLAY', trigger: '-PT5M', triggerRelation: 'START', description: 'x', isDefault: false }] })
    expect(generateICS([e], { stripAlarms: true })).not.toContain('BEGIN:VALARM')
  })
})

describe('people and locations', () => {
  it('skips an empty organizer and attendees without an address', () => {
    const e = ev({
      organizer: { name: '', email: '' },
      attendees: [
        { name: 'No mail', email: '', role: 'REQ-PARTICIPANT', status: 'NEEDS-ACTION', type: 'INDIVIDUAL', rsvp: false },
        { name: 'Pop, "Ion"', email: 'ion@example.com', role: 'CHAIR', status: 'ACCEPTED', type: 'INDIVIDUAL', rsvp: true },
      ],
    })
    const ics = generateICS([e])
    expect(ics).not.toContain('ORGANIZER')
    const attendees = lines(ics).filter((l) => l.startsWith('ATTENDEE'))
    expect(attendees).toHaveLength(1)
    expect(attendees[0]).toContain(`CN="Pop, ^'Ion^'"`)
    const parsed = oracle(ics).root.getFirstSubcomponent('vevent')!.getFirstProperty('attendee')!
    expect(parsed.getFirstValue()).toBe('mailto:ion@example.com')
  })

  it('strips personal data when asked', () => {
    const e = ev({
      organizer: { name: 'Ana', email: 'ana@example.com' },
      attendees: [{ name: 'Ion', email: 'ion@example.com', role: 'REQ-PARTICIPANT', status: 'NEEDS-ACTION', type: 'INDIVIDUAL', rsvp: false }],
      contact: 'Call Ana',
    })
    const ics = generateICS([e], { stripPersonalData: true })
    expect(ics).not.toMatch(/ORGANIZER|ATTENDEE|CONTACT|ana@|ion@/)
    expect(generateICS([e])).toContain('ORGANIZER')
  })

  it('writes Apple structured location only with coordinates', () => {
    const noGeo = ev({ location: { text: 'Somewhere', appleTitle: 'Somewhere' } })
    expect(generateICS([noGeo])).not.toContain('X-APPLE-STRUCTURED-LOCATION')
    const geo = ev({ location: { text: 'Office "HQ"', geo: { latitude: 44.43, longitude: 26.1 }, appleAddress: 'Str. 1, Bucharest' } })
    const l = line(generateICS([geo]), 'X-APPLE-STRUCTURED-LOCATION')!
    expect(l).toContain(`X-TITLE="Office ^'HQ^'"`)
    expect(l.endsWith(':geo:44.43,26.1')).toBe(true)
  })
})

describe('redaction levels', () => {
  const full = ev({
    summary: 'Doctor',
    description: 'Room 4',
    location: { text: 'Clinic' },
    organizer: { name: 'Ana', email: 'ana@example.com' },
    categories: ['Health'],
  })

  it('busy shows only that time is taken', () => {
    const ics = generateICS([full], { redactLevel: 'busy' })
    expect(line(ics, 'SUMMARY:')).toBe('SUMMARY:Busy')
    expect(ics).not.toMatch(/Doctor|Room 4|Clinic|ana@|Health/)
    expect(ics).toContain('CLASS:PRIVATE')
  })

  it('busy leaves out free and cancelled events', () => {
    const ics = generateICS([ev({ uid: 'free', transparency: 'TRANSPARENT' }), ev({ uid: 'gone', status: 'CANCELLED' }), ev({ uid: 'kept' })], { redactLevel: 'busy' })
    expect(ics).toContain('UID:kept')
    expect(ics).not.toContain('UID:free')
    expect(ics).not.toContain('UID:gone')
  })

  it('limited keeps the title but drops details', () => {
    const ics = generateICS([full], { redactLevel: 'limited' })
    expect(ics).toContain('SUMMARY:Doctor')
    expect(ics).not.toMatch(/Room 4|Clinic|ana@/)
  })
})
