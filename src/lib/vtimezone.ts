import { tzlib_get_ical_block, tzlib_get_timezones } from 'timezones-ical-library'
import type { TimezoneDefinition, TimezoneRule } from '@/types'
import type { WallTime } from './time'

// Export: VTIMEZONE blocks come from the IANA tz database (via vzic, packaged by
// timezones-ical-library) instead of being synthesised. The previous generator
// applied EU rules (last Sunday of March/October) to every zone, so New York,
// Sydney and Auckland carried wrong transition dates and Outlook — which honours
// the embedded VTIMEZONE — shifted events by an hour for weeks of the year.

let knownZones: Set<string> | null = null

function zoneList(): Set<string> {
  if (!knownZones) {
    const list = tzlib_get_timezones()
    knownZones = new Set(Array.isArray(list) ? list : (JSON.parse(list) as string[]))
  }
  return knownZones
}

/** VTIMEZONE content lines for an IANA zone, with TZID set to `tz`; null if unknown. */
export function ianaVTimezoneLines(tz: string): string[] | null {
  if (!zoneList().has(tz)) return null
  const block = tzlib_get_ical_block(tz)
  if (!Array.isArray(block) || !block[0]) return null
  return block[0]
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
    // Aliases resolve to their canonical zone; the TZID must match what DTSTART uses.
    .map((l) => (/^TZID:/i.test(l) ? `TZID:${tz}` : l))
}

// Import: TZIDs that are not IANA names (Outlook writes Windows names such as
// "Romance Standard Time" or "(UTC+02:00) Athens, Bucharest") are resolved by
// evaluating the file's own VTIMEZONE observances for the wall time in question.

function offsetMinutes(value: string): number | null {
  const m = /^([+-])(\d{2})(\d{2})(\d{2})?$/.exec(value.trim())
  if (!m) return null
  const sign = m[1] === '-' ? -1 : 1
  return sign * (+m[2]! * 60 + +m[3]!)
}

const DAY_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

/** Wall-clock onset of an observance in `year`, as minutes since the Unix epoch in local terms. */
function onsetInYear(rule: TimezoneRule, year: number): number | null {
  const ds = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?/.exec(rule.dtstart)
  if (!ds) return null
  const startYear = +ds[1]!
  const hour = +ds[4]!, minute = +ds[5]!
  if (!rule.rrule) {
    return year === startYear ? Date.UTC(startYear, +ds[2]! - 1, +ds[3]!, hour, minute) / 60000 : null
  }
  if (year < startYear) return null
  const parts = Object.fromEntries(rule.rrule.split(';').map((p) => p.split('=') as [string, string]))
  if ((parts['FREQ'] ?? '').toUpperCase() !== 'YEARLY') return null
  if (parts['UNTIL']) {
    const untilYear = +parts['UNTIL'].slice(0, 4)
    if (year > untilYear) return null
  }
  const month = parts['BYMONTH'] ? +parts['BYMONTH'] : +ds[2]!
  const byDay = parts['BYDAY']
  const byMonthDay = parts['BYMONTHDAY']?.split(',').map(Number)
  let day: number | null = null
  if (byDay) {
    const bm = /^([+-]?\d+)?([A-Z]{2})$/i.exec(byDay)
    if (!bm) return null
    const weekday = DAY_INDEX[bm[2]!.toUpperCase()]
    if (weekday === undefined) return null
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const candidates: number[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === weekday) candidates.push(d)
    }
    if (byMonthDay?.length) {
      day = candidates.find((d) => byMonthDay.includes(d)) ?? null
    } else {
      const n = bm[1] ? +bm[1] : 1
      day = (n > 0 ? candidates[n - 1] : candidates[candidates.length + n]) ?? null
    }
  } else if (byMonthDay?.length) {
    day = byMonthDay[0]!
  } else {
    day = +ds[3]!
  }
  if (day === null) return null
  return Date.UTC(year, month - 1, day, hour, minute) / 60000
}

/**
 * Offset resolver (minutes east of UTC) for wall times in a parsed VTIMEZONE.
 * Null when the definition has no usable observance.
 */
export function vtimezoneOffsetResolver(def: TimezoneDefinition): ((w: WallTime) => number | null) | null {
  const observances = [def.standard, def.daylight].filter((r): r is TimezoneRule => !!r)
  if (observances.length === 0) return null
  return (w: WallTime) => {
    const t = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) / 60000
    let best: { at: number; offset: number } | null = null
    for (const obs of observances) {
      const offset = offsetMinutes(obs.tzoffsetto)
      if (offset === null) continue
      for (const year of [w.year, w.year - 1]) {
        const at = onsetInYear(obs, year)
        if (at !== null && at <= t && (!best || at > best.at)) best = { at, offset }
      }
    }
    if (best) return best.offset
    // Before any onset: fall back to the standard offset (or the only one present).
    return offsetMinutes((def.standard ?? def.daylight)!.tzoffsetto)
  }
}
