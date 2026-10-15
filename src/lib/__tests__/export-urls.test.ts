import { describe, expect, it } from 'vitest'
import { generateGoogleCalendarUrl, generateOutlookUrl } from '@/lib/export-urls'
import { ev, wall } from './helpers'

describe('add-to-calendar links', () => {
  it('Google gets real UTC times and the event zone', () => {
    const url = new URL(generateGoogleCalendarUrl(ev({ summary: 'Team sync' })))
    // 10:00 in Bucharest (EEST, UTC+3) on 15 Oct 2026 is 07:00Z.
    expect(url.searchParams.get('dates')).toBe('20261015T070000Z/20261015T080000Z')
    expect(url.searchParams.get('ctz')).toBe('Europe/Bucharest')
    expect(url.toString()).toContain('text=Team%20sync')
  })

  it('Google all-day uses dates with an exclusive end', () => {
    const url = new URL(generateGoogleCalendarUrl(ev({ allDay: true, startDate: wall('2026-10-15T00:00', 'Europe/Bucharest') })))
    expect(url.searchParams.get('dates')).toBe('20261015/20261016')
  })

  it('Google keeps the full RRULE', () => {
    const tz = 'Europe/Bucharest'
    const url = new URL(generateGoogleCalendarUrl(ev({ recurrenceRule: { frequency: 'WEEKLY', interval: 1, byDay: ['TH'], until: wall('2026-12-31T23:59', tz) } })))
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=WEEKLY;UNTIL=20261231T215900Z;BYDAY=TH')
  })

  it('Outlook all-day sends dates, timed sends UTC instants', () => {
    const allDay = new URL(generateOutlookUrl(ev({ allDay: true, startDate: wall('2026-10-15T00:00', 'Europe/Bucharest') })))
    expect(allDay.searchParams.get('startdt')).toBe('2026-10-15')
    expect(allDay.searchParams.get('enddt')).toBe('2026-10-16')
    expect(allDay.searchParams.get('allday')).toBe('true')
    const timed = new URL(generateOutlookUrl(ev()))
    expect(timed.searchParams.get('startdt')).toBe('2026-10-15T07:00:00.000Z')
  })
})
