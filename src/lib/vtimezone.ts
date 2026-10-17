import { tzlib_get_ical_block, tzlib_get_timezones } from 'timezones-ical-library'
import type { TimezoneDefinition, TimezoneRule } from '@/types'
import { tzOffset } from '@date-fns/tz'
import { toWall, type WallTime } from './time'

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

// ── Export: check the library block against the runtime tz data ──────────────
// Wall times in DTSTART;TZID=… come from Intl (the runtime's tz database). The
// embedded VTIMEZONE comes from timezones-ical-library's own tz build, and for a
// few zones the two disagree (Africa/Casablanca was +0000 all year, Vancouver and
// Edmonton lost their pre-2026 rules), and its blocks carry only the current
// rules, so dates before a rule change (New York before 2007) disagree too.
// Clients that honour the VTIMEZONE (Outlook, Thunderbird) then placed those
// events an hour off. So the block is used only if it gives the Intl offset at
// every instant the export needs; otherwise one is built from Intl's own
// transitions.

const MINUTE = 60_000
const DAY = 86_400_000

/** Minutes east of UTC in `tz` at `ms`, from Intl. */
function intlOffset(tz: string, ms: number): number {
  return Math.round(tzOffset(tz, new Date(ms)))
}

interface Observance {
  rule: TimezoneRule
  offset: number
  rdates: number[]
}

const localMinutes = (v: string): number | null => {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(v.trim())
  return m ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!) / MINUTE : null
}

function parseObservances(lines: string[]): Observance[] {
  const out: Observance[] = []
  let cur: { dtstart?: string; rrule?: string; to?: string; rdates: string[] } | null = null
  for (const line of lines) {
    if (/^BEGIN:(STANDARD|DAYLIGHT)$/i.test(line)) cur = { rdates: [] }
    else if (/^END:(STANDARD|DAYLIGHT)$/i.test(line) && cur) {
      const offset = cur.to ? offsetMinutes(cur.to) : null
      if (cur.dtstart && offset !== null) {
        const rdates = cur.rdates
          .flatMap((v) => v.split(','))
          .map(localMinutes)
          .filter((m): m is number => m !== null)
        out.push({ rule: { dtstart: cur.dtstart, rrule: cur.rrule, tzname: '', tzoffsetfrom: '', tzoffsetto: cur.to! }, offset, rdates })
      }
      cur = null
    } else if (cur) {
      const [name, ...rest] = line.split(':')
      const value = rest.join(':')
      const key = name!.split(';')[0]!.toUpperCase()
      if (key === 'DTSTART') cur.dtstart = value
      else if (key === 'RRULE') cur.rrule = value
      else if (key === 'TZOFFSETTO') cur.to = value
      else if (key === 'RDATE') cur.rdates.push(value)
    }
  }
  return out
}

/** Latest onset (local minutes) of an observance at or before `t`, or null. */
function latestOnset(obs: Observance, t: number, year: number): number | null {
  let best: number | null = null
  const consider = (at: number | null) => {
    if (at !== null && at <= t && (best === null || at > best)) best = at
  }
  for (const r of obs.rdates) consider(r)
  if (!obs.rule.rrule) {
    consider(localMinutes(obs.rule.dtstart))
    return best
  }
  // Yearly rule: walk back from this year until an onset is found.
  for (let y = year; y >= year - 60; y--) {
    const at = onsetInYear(obs.rule, y)
    if (at !== null && at <= t) {
      consider(at)
      break
    }
  }
  return best
}

/**
 * Offset the block gives for a wall time, evaluating every observance (history
 * included). Null before the block's first onset: clients disagree there
 * (ical.js uses UTC), so such a wall time needs a block that covers it.
 */
function blockOffset(observances: Observance[], w: WallTime): number | null {
  const t = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) / MINUTE
  let best: { at: number; offset: number } | null = null
  for (const obs of observances) {
    const at = latestOnset(obs, t, w.year)
    if (at !== null && (!best || at > best.at)) best = { at, offset: obs.offset }
  }
  return best?.offset ?? null
}

function blockAgreesWithIntl(lines: string[], tz: string, instants: number[]): boolean {
  const observances = parseObservances(lines)
  if (observances.length === 0) return false
  for (const ms of instants) {
    const expected = intlOffset(tz, ms)
    const w = toWall(ms, tz)
    if (blockOffset(observances, w) === expected) continue
    // Wall times inside a transition's gap/overlap are ambiguous by nature;
    // only count a disagreement that holds an hour on either side too.
    const stable = intlOffset(tz, ms - 2 * 3600_000) === expected && intlOffset(tz, ms + 2 * 3600_000) === expected
    if (stable) return false
  }
  return true
}

const fmtOffset = (min: number) => {
  const sign = min < 0 ? '-' : '+'
  const a = Math.abs(min)
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}${String(a % 60).padStart(2, '0')}`
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const fmtLocal = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`
}

interface Transition {
  /** UTC instant of the first minute with the new offset. */
  at: number
  from: number
  to: number
}

// Transitions per zone and year. Feeds re-render the same zones over and over,
// and a scan costs one Intl lookup per day.
const transitionCache = new Map<string, Transition[]>()

/**
 * Offset changes in `tz` during a UTC calendar year, from Intl, found by probing
 * every `step` ms. A step of a week can miss two changes within one week, which
 * tz history has but the rules Intl projects for future years do not.
 */
function transitionsInYear(tz: string, year: number, step = DAY): Transition[] {
  const key = `${tz}|${year}|${step}`
  const hit = transitionCache.get(key)
  if (hit) return hit
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  const out: Transition[] = []
  let prev = intlOffset(tz, start)
  for (let t = start + step; t < end + step; t += step) {
    const at = Math.min(t, end)
    const cur = intlOffset(tz, at)
    if (cur === prev) continue
    // Binary search the first minute with the new offset.
    let lo = at - step
    let hi = at
    while (hi - lo > MINUTE) {
      const mid = lo + Math.floor((hi - lo) / MINUTE / 2) * MINUTE
      if (intlOffset(tz, mid) === prev) lo = mid
      else hi = mid
    }
    out.push({ at: hi, from: prev, to: cur })
    prev = cur
  }
  if (transitionCache.size >= 20_000) transitionCache.clear()
  transitionCache.set(key, out)
  return out
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
const WEEK = 7 * DAY

/**
 * Years checked past the last covered one before a yearly RRULE is written: one
 * full 28-year cycle of weekdays on dates, so "Friday on or after 23 March" is
 * not taken for "fourth Friday" because the two matched for a few years.
 */
const RULE_CHECK_YEARS = 28
/** Years of fixed observances added past the last covered one when no RRULE fits. */
const FIXED_EXTRA_YEARS = 10

/**
 * A yearly RRULE for the i-th transition of each year, if Intl places it the
 * same way in every one of `years`: same month, local time and offsets, and a day
 * that one BYDAY / BYMONTHDAY form describes. Null otherwise (Casablanca's
 * Ramadan changes, a rule change inside the window).
 */
function yearlyRule(tz: string, years: number[], i: number): { rrule: string; first: Transition } | null {
  const picks = years.map((y) => transitionsInYear(tz, y, WEEK)[i])
  if (picks.some((p) => !p)) return null
  const local = (picks as Transition[]).map((p) => {
    const d = new Date(p.at + p.from * MINUTE)
    return { p, month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay(), hm: d.getUTCHours() * 60 + d.getUTCMinutes(), dim: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate() }
  })
  const a = local[0]!
  if (local.some((x) => x.month !== a.month || x.hm !== a.hm || x.p.from !== a.p.from || x.p.to !== a.p.to)) return null
  const base = `FREQ=YEARLY;BYMONTH=${a.month}`
  if (local.every((x) => x.day === a.day)) return { rrule: `${base};BYMONTHDAY=${a.day}`, first: a.p }
  if (local.some((x) => x.weekday !== a.weekday)) return null
  const wd = WEEKDAYS[a.weekday]!
  if (local.every((x) => x.day + 7 > x.dim)) return { rrule: `${base};BYDAY=-1${wd}`, first: a.p }
  const nth = Math.ceil(a.day / 7)
  if (local.every((x) => Math.ceil(x.day / 7) === nth)) return { rrule: `${base};BYDAY=${nth}${wd}`, first: a.p }
  // "Weekday on or after day k" (Israel: Friday on or after 23 March).
  const k = Math.max(...local.map((x) => x.day)) - 6
  if (k >= 1 && local.every((x) => x.day >= k && x.day <= k + 6)) {
    const days = Array.from({ length: 7 }, (_, j) => k + j).join(',')
    return { rrule: `${base};BYMONTHDAY=${days};BYDAY=${wd}`, first: a.p }
  }
  return null
}

/**
 * A VTIMEZONE built from Intl's transitions for the given years: for each run of
 * consecutive years, an observance at its start with the offset then in force,
 * then one observance per offset change. After the last year it continues with
 * yearly RRULE observances when Intl's following years follow one pattern, so
 * clients keep switching offsets for occurrences past the covered years;
 * otherwise fixed observances run on for another FIXED_EXTRA_YEARS.
 */
export function intlVTimezoneLines(tz: string, coveredYears: number[]): string[] {
  const years = [...new Set(coveredYears)].sort((x, y) => x - y)
  const lines = ['BEGIN:VTIMEZONE', `TZID:${tz}`]
  if (years.length === 0) {
    lines.push('END:VTIMEZONE')
    return lines
  }
  const last = years[years.length - 1]!
  const checkYears = Array.from({ length: RULE_CHECK_YEARS }, (_, j) => last + 1 + j)
  const counts = checkYears.map((y) => transitionsInYear(tz, y, WEEK).length)
  let tail: { rrule: string; first: Transition }[] | null = null
  if (counts.every((n) => n === counts[0])) {
    const rules = Array.from({ length: counts[0]! }, (_, i) => yearlyRule(tz, checkYears, i))
    if (rules.every((r) => r !== null)) tail = rules as { rrule: string; first: Transition }[]
  }
  if (!tail) for (let y = last + 1; y <= last + FIXED_EXTRA_YEARS; y++) years.push(y)

  const fixed: { onset: number; from: number; to: number }[] = []
  let runStart: number | null = null
  for (let j = 0; j < years.length; j++) {
    const y = years[j]!
    if (runStart === null || years[j - 1] !== y - 1) {
      const start = Date.UTC(y, 0, 1)
      const initial = intlOffset(tz, start)
      fixed.push({ onset: start + initial * MINUTE, from: initial, to: initial })
      runStart = y
    }
    for (const x of transitionsInYear(tz, y)) fixed.push({ onset: x.at + x.from * MINUTE, from: x.from, to: x.to })
  }
  const offsets = [...fixed.map((f) => f.to), ...(tail ?? []).map((r) => r.first.to)]
  let standard = Infinity
  for (const o of offsets) if (o < standard) standard = o
  const observance = (onsetLocalMs: number, from: number, to: number, rrule?: string) => {
    const kind = to > standard ? 'DAYLIGHT' : 'STANDARD'
    lines.push(`BEGIN:${kind}`, `DTSTART:${fmtLocal(onsetLocalMs)}`, ...(rrule ? [`RRULE:${rrule}`] : []), `TZOFFSETFROM:${fmtOffset(from)}`, `TZOFFSETTO:${fmtOffset(to)}`, `END:${kind}`)
  }
  for (const f of fixed) observance(f.onset, f.from, f.to)
  for (const r of tail ?? []) observance(r.first.at + r.first.from * MINUTE, r.first.from, r.first.to, r.rrule)
  lines.push('END:VTIMEZONE')
  return lines
}

/** Instants checked per zone; a larger set is thinned evenly. */
const MAX_CHECKED_INSTANTS = 20_000
/** Years given fixed observances in a built block; the ones nearest the present win. */
const MAX_COVERED_YEARS = 200

/**
 * VTIMEZONE lines for `tz` that agree with the runtime tz data at `instants`
 * (the DTSTART/DTEND/EXDATE/RDATE/RECURRENCE-ID values and sampled occurrences
 * of the events exported in that zone).
 */
export function vtimezoneLinesFor(tz: string, all: number[]): string[] | null {
  // One instant per day is enough to see a disagreement and keeps big calendars cheap.
  const seen = new Set<number>()
  let instants = all.filter((ms) => {
    if (!Number.isFinite(ms)) return false
    const day = Math.floor(ms / DAY)
    if (seen.has(day)) return false
    seen.add(day)
    return true
  })
  if (instants.length === 0) return ianaVTimezoneLines(tz)
  if (instants.length > MAX_CHECKED_INSTANTS) {
    const step = instants.length / MAX_CHECKED_INSTANTS
    instants = Array.from({ length: MAX_CHECKED_INSTANTS }, (_, j) => instants[Math.floor(j * step)]!)
  }
  const lib = ianaVTimezoneLines(tz)
  if (lib && blockAgreesWithIntl(lib, tz, instants)) return lib
  // DTSTART years are four digits; anything outside that cannot be written anyway.
  const years = new Set<number>()
  for (const ms of instants) {
    const y = new Date(ms).getUTCFullYear()
    if (y >= 1000 && y <= 9990) years.add(y)
  }
  let covered = [...years]
  if (covered.length > MAX_COVERED_YEARS) {
    const current = new Date().getUTCFullYear()
    covered = covered.sort((x, y) => Math.abs(x - current) - Math.abs(y - current)).slice(0, MAX_COVERED_YEARS)
  }
  return intlVTimezoneLines(tz, covered)
}
