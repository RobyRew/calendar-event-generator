import { describe, expect, it } from 'vitest'
import {
  addDaysIn, combineWall, formatDuration, formatICSDate, formatICSWall, parseDuration, startOfDayIn, toWall,
} from '@/lib/time'
import { normalizeEvent } from '@/lib/normalize'
import { wall } from './helpers'

describe('wall time conversion', () => {
  it('round-trips wall time in a zone, independent of the host zone', () => {
    const iso = combineWall('2026-03-08', '10:00', 'America/New_York')! // first day of EDT
    expect(iso).toBe('2026-03-08T14:00:00.000Z')
    expect(formatICSWall(iso, 'America/New_York')).toBe('20260308T100000')
    expect(toWall(iso, 'Europe/Bucharest')).toMatchObject({ hour: 16, day: 8 })
  })

  it('adds calendar days across DST changes keeping the wall clock', () => {
    const before = combineWall('2026-10-24', '10:00', 'Europe/Bucharest')!
    const after = addDaysIn(before, 2, 'Europe/Bucharest')
    expect(formatICSWall(after, 'Europe/Bucharest')).toBe('20261026T100000')
    expect(new Date(after).getTime() - new Date(before).getTime()).toBe(49 * 3600_000)
  })

  it('computes dates in the event zone, not the host zone', () => {
    const lateEvening = '2026-10-15T22:30:00.000Z'
    expect(formatICSDate(lateEvening, 'Europe/Bucharest')).toBe('20261016')
    expect(formatICSDate(lateEvening, 'America/Los_Angeles')).toBe('20261015')
    expect(startOfDayIn(lateEvening, 'Europe/Bucharest')).toBe('2026-10-15T21:00:00.000Z')
  })
})

describe('durations', () => {
  it('parses RFC durations and the legacy -PT1D form', () => {
    expect(parseDuration('-PT15M')).toBe(-900)
    expect(parseDuration('-P1D')).toBe(-86400)
    expect(parseDuration('-PT1D')).toBe(-86400)
    expect(parseDuration('P1W')).toBe(604800)
    expect(parseDuration('PT1H30M')).toBe(5400)
    expect(parseDuration('PT0S')).toBe(0)
    expect(parseDuration('P')).toBeNull()
    expect(parseDuration('nope')).toBeNull()
  })

  it('formats canonically', () => {
    expect(formatDuration(-86400)).toBe('-P1D')
    expect(formatDuration(-604800)).toBe('-P1W')
    expect(formatDuration(-90000)).toBe('-P1DT1H')
    expect(formatDuration(0)).toBe('PT0S')
  })
})

describe('normalizeEvent', () => {
  it('fills missing fields so partial JSON imports do not crash', () => {
    const e = normalizeEvent({ summary: 'From JSON', startDate: '2026-10-15T07:00:00.000Z' } as never)
    expect(e.categories).toEqual([])
    expect(e.attendees).toEqual([])
    expect(e.endDate).toBe('2026-10-15T07:00:00.000Z')
  })

  it('gives all-day events an exclusive end at least a day after the start', () => {
    const start = wall('2026-10-15T00:00', 'Europe/Bucharest')
    const e = normalizeEvent({ allDay: true, timezone: 'Europe/Bucharest', startDate: start, endDate: start })
    expect(e.endDate).toBe(wall('2026-10-16T00:00', 'Europe/Bucharest'))
  })

  it('drops COUNT when UNTIL is set and repairs legacy values', () => {
    const e = normalizeEvent({
      timezone: 'UTC',
      recurrenceRule: { frequency: 'DAILY', interval: 0, count: 3, until: '2026-12-01T00:00:00.000Z' },
      recurrenceId: '20261029T100000Z',
      alarms: [{ uid: 'a', action: 'DISPLAY', trigger: '-PT2D', triggerRelation: 'START', description: '', isDefault: false, acknowledged: 'garbage' }],
      organizer: { name: '', email: '' },
    })
    expect(e.recurrenceRule).toEqual({ frequency: 'DAILY', interval: 1, until: '2026-12-01T00:00:00.000Z' })
    expect(e.recurrenceId).toBe('2026-10-29T10:00:00.000Z')
    expect(e.alarms[0]!.trigger).toBe('-P2D')
    expect(e.alarms[0]!.acknowledged).toBeUndefined()
    expect(e.organizer).toBeNull()
  })
})
