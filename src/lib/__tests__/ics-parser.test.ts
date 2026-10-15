import { describe, expect, it } from 'vitest'
import { generateICS } from '@/lib/ics-generator'
import { parseICS, parseICSBytes } from '@/lib/ics-parser'
import { eventKey } from '@/lib/utils'
import { ev, wall } from './helpers'

const cal = (...body: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...body, 'END:VCALENDAR'].join('\r\n')
const opts = { defaultTimezone: 'Europe/Bucharest' }

describe('round trip', () => {
  it('parse(generate(e)) preserves the event', () => {
    const tz = 'America/New_York'
    const original = ev({
      uid: 'RT-1',
      timezone: tz,
      startDate: wall('2026-10-15T10:00', tz),
      endDate: wall('2026-10-15T11:30', tz),
      summary: 'Plan; review, ship',
      description: 'C:\\new folder\nline 2',
      categories: ['Work, important', 'Q4'],
      location: { text: 'HQ', geo: { latitude: 40.7, longitude: -74 } },
      organizer: { name: 'Ana Pop', email: 'ana@example.com' },
      recurrenceRule: { frequency: 'WEEKLY', interval: 2, byDay: ['TH'], until: wall('2026-12-31T23:59', tz) },
      recurrenceExceptions: [wall('2026-10-29T10:00', tz)],
      alarms: [{ uid: 'AL-1', action: 'DISPLAY', trigger: '-P1D', triggerRelation: 'START', description: 'Tomorrow', isDefault: false }],
      sequence: 3,
    })
    const [parsed] = parseICS(generateICS([original]), opts).events
    expect(parsed).toBeDefined()
    for (const key of ['uid', 'summary', 'description', 'startDate', 'endDate', 'timezone', 'allDay', 'categories', 'organizer', 'recurrenceExceptions', 'sequence'] as const) {
      expect(parsed![key]).toEqual(original[key])
    }
    expect(parsed!.recurrenceRule).toMatchObject({ frequency: 'WEEKLY', interval: 2, byDay: ['TH'], until: new Date(Math.floor(new Date(original.recurrenceRule!.until!).getTime() / 1000) * 1000).toISOString() })
    expect(parsed!.alarms[0]).toMatchObject({ trigger: '-P1D', description: 'Tomorrow', uid: 'AL-1' })
    expect(parsed!.location?.geo).toEqual({ latitude: 40.7, longitude: -74 })
  })

  it('re-importing an export gives the same revision (no false "modified" duplicates)', () => {
    const original = ev({ lastModified: '2026-10-01T08:00:00.123Z' })
    const [parsed] = parseICS(generateICS([original]), opts).events
    expect(Math.floor(new Date(parsed!.lastModified).getTime() / 1000)).toBe(Math.floor(new Date(original.lastModified).getTime() / 1000))
    expect(parsed!.sequence).toBe(original.sequence)
  })

  it('keeps a recurrence override next to its master', () => {
    const tz = 'Europe/Bucharest'
    const master = ev({ uid: 'R', recurrenceRule: { frequency: 'WEEKLY', interval: 1, count: 4 } })
    const override = ev({ uid: 'R', startDate: wall('2026-10-22T12:00', tz), endDate: wall('2026-10-22T13:00', tz), recurrenceId: wall('2026-10-22T10:00', tz), summary: 'Moved' })
    const events = parseICS(generateICS([master, override]), opts).events
    expect(events).toHaveLength(2)
    expect(new Set(events.map(eventKey)).size).toBe(2)
    expect(events.find((e) => e.recurrenceId)!.recurrenceId).toBe(wall('2026-10-22T10:00', tz))
  })

  it('all-day events stay on their day in every host zone', () => {
    const e = ev({ allDay: true, timezone: 'Pacific/Auckland', startDate: wall('2026-10-15T00:00', 'Pacific/Auckland') })
    const [parsed] = parseICS(generateICS([e]), { defaultTimezone: 'Pacific/Auckland' }).events
    expect(parsed!.startDate).toBe(e.startDate)
    expect(parsed!.endDate).toBe(wall('2026-10-16T00:00', 'Pacific/Auckland'))
  })
})

describe('parser robustness', () => {
  it('uses DURATION when DTEND is missing, and RFC defaults when both are', () => {
    const { events } = parseICS(cal(
      'BEGIN:VEVENT', 'UID:a', 'DTSTART:20270101T100000Z', 'DURATION:PT2H', 'SUMMARY:A', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:b', 'DTSTART;VALUE=DATE:20270101', 'SUMMARY:B', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:c', 'DTSTART:20270101T100000Z', 'SUMMARY:C', 'END:VEVENT',
    ), opts)
    expect(events.find((e) => e.uid === 'a')!.endDate).toBe('2027-01-01T12:00:00.000Z')
    const b = events.find((e) => e.uid === 'b')!
    expect(b.allDay).toBe(true)
    expect(b.endDate).toBe(wall('2027-01-02T00:00', 'Europe/Bucharest'))
    expect(events.find((e) => e.uid === 'c')!.endDate).toBe('2027-01-01T10:00:00.000Z')
  })

  it('reads EXDATE lists, escaped commas in CATEGORIES and repeated CATEGORIES', () => {
    const [e] = parseICS(cal(
      'BEGIN:VEVENT', 'UID:x', 'DTSTART:20270101T100000Z', 'DTEND:20270101T110000Z',
      'RRULE:FREQ=WEEKLY;COUNT=5',
      'EXDATE:20270108T100000Z,20270115T100000Z',
      'CATEGORIES:Work\\, Personal,Q1', 'CATEGORIES:Extra',
      'END:VEVENT',
    ), opts).events
    expect(e!.recurrenceExceptions).toEqual(['2027-01-08T10:00:00.000Z', '2027-01-15T10:00:00.000Z'])
    expect(e!.categories).toEqual(['Work, Personal', 'Q1', 'Extra'])
  })

  it('reads EXDATE in its own TZID', () => {
    const [e] = parseICS(cal(
      'BEGIN:VEVENT', 'UID:x', 'DTSTART;TZID=America/New_York:20261015T100000', 'DTEND;TZID=America/New_York:20261015T110000',
      'RRULE:FREQ=WEEKLY;COUNT=4', 'EXDATE;TZID=America/New_York:20261022T100000', 'END:VEVENT',
    ), opts).events
    expect(e!.timezone).toBe('America/New_York')
    expect(e!.recurrenceExceptions).toEqual([wall('2026-10-22T10:00', 'America/New_York')])
  })

  it('skips one bad date instead of failing the file', () => {
    const { events } = parseICS(cal(
      'BEGIN:VEVENT', 'UID:bad', 'DTSTART;VALUE=DATE:2026-10-15', 'SUMMARY:Bad', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:good', 'DTSTART:20261015T100000Z', 'CREATED:notadate', 'SUMMARY:Good', 'END:VEVENT',
    ), opts)
    expect(events.map((e) => e.uid)).toEqual(['good'])
  })

  it('accepts CR-only and LF-only line endings, BOM, and lowercase names', () => {
    const body = ['\uFEFFbegin:vcalendar', 'version:2.0', 'begin:vevent', 'uid:lc', 'dtstart;value=date:20261015', 'summary:Lower', 'status:tentative', 'end:vevent', 'end:vcalendar']
    for (const sep of ['\r', '\n']) {
      const [e] = parseICS(body.join(sep), opts).events
      expect(e).toMatchObject({ uid: 'lc', summary: 'Lower', allDay: true, status: 'TENTATIVE' })
    }
  })

  it('unescapes TEXT in one pass', () => {
    const [e] = parseICS(cal('BEGIN:VEVENT', 'UID:t', 'DTSTART:20261015T100000Z', 'SUMMARY:C:\\\\new folder\\, ok\\nnext', 'END:VEVENT'), opts).events
    expect(e!.summary).toBe('C:\\new folder, ok\nnext')
  })

  it('reads quoted multi-value parameters and RFC 6868 encoding', () => {
    const [e] = parseICS(cal(
      'BEGIN:VEVENT', 'UID:p', 'DTSTART:20261015T100000Z',
      `ATTENDEE;CN="Pop, ^'Ion^'";DELEGATED-TO="mailto:a@x.test","mailto:b@x.test";PARTSTAT=accepted:MAILTO:ion@x.test`,
      'END:VEVENT',
    ), opts).events
    expect(e!.attendees[0]).toMatchObject({ name: 'Pop, "Ion"', email: 'ion@x.test', status: 'ACCEPTED', delegatedTo: 'a@x.test,b@x.test' })
  })

  it('resolves Windows TZIDs through the file VTIMEZONE', () => {
    const ics = cal(
      'BEGIN:VTIMEZONE', 'TZID:GTB Standard Time',
      'BEGIN:STANDARD', 'DTSTART:16010101T040000', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10', 'END:STANDARD',
      'BEGIN:DAYLIGHT', 'DTSTART:16010101T030000', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0300', 'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3', 'END:DAYLIGHT',
      'END:VTIMEZONE',
      'BEGIN:VEVENT', 'UID:w1', 'DTSTART;TZID="GTB Standard Time":20260715T100000', 'DTEND;TZID="GTB Standard Time":20260715T110000', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:w2', 'DTSTART;TZID="GTB Standard Time":20260115T100000', 'DTEND;TZID="GTB Standard Time":20260115T110000', 'END:VEVENT',
    )
    const events = parseICS(ics, opts).events
    expect(events.find((e) => e.uid === 'w1')!.startDate).toBe('2026-07-15T07:00:00.000Z')
    expect(events.find((e) => e.uid === 'w2')!.startDate).toBe('2026-01-15T08:00:00.000Z')
  })

  it('unfolds before decoding, so a fold inside a UTF-8 character survives', () => {
    const head = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:f\r\nDTSTART:20261015T100000Z\r\nSUMMARY:Ș'
    const bytes = new TextEncoder().encode('ț')
    const tail = '\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    const enc = new TextEncoder()
    const all = new Uint8Array([...enc.encode(head), bytes[0]!, 0x0d, 0x0a, 0x20, bytes[1]!, ...enc.encode(tail)])
    expect(parseICSBytes(all, opts).events[0]!.summary).toBe('Șț')
  })

  it('keeps RECURRENCE-ID parameters and absolute alarm triggers', () => {
    const [e] = parseICS(cal(
      'BEGIN:VEVENT', 'UID:r', 'RECURRENCE-ID;TZID=America/New_York:20261029T100000',
      'DTSTART;TZID=America/New_York:20261029T120000', 'DTEND;TZID=America/New_York:20261029T130000',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER;VALUE=DATE-TIME:19760401T005545Z', 'ACKNOWLEDGED:20261001T000000Z', 'END:VALARM',
      'END:VEVENT',
    ), opts).events
    expect(e!.recurrenceId).toBe(wall('2026-10-29T10:00', 'America/New_York'))
    expect(e!.alarms[0]).toMatchObject({ trigger: '19760401T005545Z', acknowledged: '2026-10-01T00:00:00.000Z' })
    expect(generateICS([e!])).toContain('TRIGGER;VALUE=DATE-TIME:19760401T005545Z')
  })

  it('maps COLOR names back to hex', () => {
    const [e] = parseICS(cal('BEGIN:VEVENT', 'UID:c', 'DTSTART:20261015T100000Z', 'COLOR:dodgerblue', 'END:VEVENT'), opts).events
    expect(e!.color).toBe('#1e90ff')
  })
})
