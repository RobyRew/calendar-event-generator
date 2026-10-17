import type { CalendarEvent } from '@/types'
import { combineWall, toWall, wallDateString } from './time'

type RecurrenceFields = Pick<CalendarEvent, 'recurrenceExceptions' | 'recurrenceDates' | 'recurrenceRule'>

const SUB_DAILY = new Set(['HOURLY', 'MINUTELY', 'SECONDLY'])

/**
 * After the start's time of day or the all-day flag changes, move the EXDATEs and
 * RDATEs that sat at the series' old time of day to the new one, each on its own
 * day, and UNTIL to the end of its day (or midnight for all-day). An EXDATE names
 * an occurrence by its start instant, so leaving it at the old time made it match
 * nothing and the cancelled occurrence came back.
 *
 * `prev` is the event before the change. A move that keeps the time of day and the
 * all-day flag (a date-only move) changes nothing. Entries at another time of day
 * (from BYHOUR/BYMINUTE, or an RDATE at its own time) stay where they are, and
 * UNTIL is left alone for sub-daily or BYHOUR/BYMINUTE/BYSECOND rules, where it
 * cuts the series at an exact time.
 */
export function reanchorRecurrence(
  prev: RecurrenceFields & Pick<CalendarEvent, 'startDate' | 'allDay'>,
  startDate: string,
  allDay: boolean,
  tz: string,
): RecurrenceFields {
  const unchanged: RecurrenceFields = {
    recurrenceExceptions: prev.recurrenceExceptions,
    recurrenceDates: prev.recurrenceDates,
    recurrenceRule: prev.recurrenceRule,
  }
  const timeOf = (iso: string, isAllDay: boolean) => {
    if (isAllDay) return '00:00:00'
    const w = toWall(iso, tz)
    return `${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}:${String(w.second).padStart(2, '0')}`
  }
  const oldTime = timeOf(prev.startDate, prev.allDay)
  const newTime = timeOf(startDate, allDay)
  if (prev.allDay === allDay && oldTime === newTime) return unchanged

  const follow = (iso: string) => (timeOf(iso, false) === oldTime ? (combineWall(wallDateString(iso, tz), newTime, tz) ?? iso) : iso)
  const rule = prev.recurrenceRule
  const exactUntil = !!rule && (SUB_DAILY.has(rule.frequency) || !!rule.byHour?.length || !!rule.byMinute?.length || !!rule.bySecond?.length)
  const until = rule?.until
  return {
    recurrenceExceptions: prev.recurrenceExceptions.map(follow),
    recurrenceDates: prev.recurrenceDates?.map(follow),
    recurrenceRule: rule && until && !exactUntil
      ? { ...rule, until: combineWall(wallDateString(until, tz), allDay ? '00:00' : '23:59:59', tz) ?? until }
      : rule,
  }
}
