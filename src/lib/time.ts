import { TZDate } from '@date-fns/tz'

// Time model for CalendarEvent:
//   startDate / endDate / recurrenceExceptions / recurrenceId / until are true UTC
//   instants (ISO strings). `event.timezone` is the IANA zone the wall clock is
//   entered and exported in. Nothing here reads the host's local zone, so the same
//   event produces the same ICS in a browser in Bucharest and on a server in UTC.
//   All-day events are stored as midnight in `event.timezone`, with an exclusive end.
//
// The previous code formatted with local getters (getHours/getDate) and labelled
// the result with event.timezone, so one event exported as three different moments
// depending on the output (ICS TZID branch vs UTC branch vs Google link).

export const UTC_ZONE = 'UTC'

const UTC_ALIASES = new Set(['UTC', 'ETC/UTC', 'GMT', 'ETC/GMT', 'Z', 'ZULU', 'UNIVERSAL', 'ETC/UNIVERSAL', 'ETC/ZULU'])

export function isUTCZone(tz: string | undefined | null): boolean {
  return !tz || UTC_ALIASES.has(tz.toUpperCase())
}

const validity = new Map<string, boolean>()

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false
  const cached = validity.get(tz)
  if (cached !== undefined) return cached
  let ok = false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    ok = true
  } catch {
    ok = false
  }
  validity.set(tz, ok)
  return ok
}

/** A usable zone for calculations: the zone itself when valid, otherwise UTC. */
export function resolveZone(tz: string | undefined | null): string {
  if (isUTCZone(tz)) return UTC_ZONE
  return isValidTimeZone(tz) ? tz : UTC_ZONE
}

export function hostTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || UTC_ZONE
  } catch {
    return UTC_ZONE
  }
}

export interface WallTime {
  year: number
  /** 1–12 */
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

export function toWall(iso: string | number | Date, tz: string): WallTime {
  const ms = typeof iso === 'number' ? iso : new Date(iso).getTime()
  const d = new TZDate(ms, resolveZone(tz))
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  }
}

/** Instant (ISO, UTC) for a wall-clock time in `tz`. Nonexistent DST-gap times move forward. */
export function fromWall(w: WallTime, tz: string): string {
  const d = new TZDate(w.year, w.month - 1, w.day, w.hour, w.minute, w.second, resolveZone(tz))
  return new Date(d.getTime()).toISOString()
}

export function isValidISO(iso: string | undefined | null): iso is string {
  return !!iso && !Number.isNaN(new Date(iso).getTime())
}

// ── ICS value formatting ───────────────────────────────────────────────────

export function formatICSUTC(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

export function formatICSWall(iso: string, tz: string): string {
  const w = toWall(iso, tz)
  return `${pad(w.year, 4)}${pad(w.month)}${pad(w.day)}T${pad(w.hour)}${pad(w.minute)}${pad(w.second)}`
}

export function formatICSDate(iso: string, tz: string): string {
  const w = toWall(iso, tz)
  return `${pad(w.year, 4)}${pad(w.month)}${pad(w.day)}`
}

// ── Form helpers (yyyy-MM-dd / HH:mm in the event's zone) ───────────────────

export function wallDateString(iso: string, tz: string): string {
  const w = toWall(iso, tz)
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`
}

export function wallTimeString(iso: string, tz: string): string {
  const w = toWall(iso, tz)
  return `${pad(w.hour)}:${pad(w.minute)}`
}

/** Combine a `yyyy-MM-dd` date and an `HH:mm[:ss]` time in `tz`; null when unparseable. */
export function combineWall(dateStr: string, timeStr: string, tz: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr)
  if (!dm || !tm) return null
  const w: WallTime = {
    year: +dm[1]!, month: +dm[2]!, day: +dm[3]!,
    hour: +tm[1]!, minute: +tm[2]!, second: tm[3] ? +tm[3] : 0,
  }
  if (w.month < 1 || w.month > 12 || w.day < 1 || w.day > 31 || w.hour > 23 || w.minute > 59) return null
  return fromWall(w, tz)
}

// ── Day arithmetic in a zone ────────────────────────────────────────────────

export function startOfDayIn(iso: string, tz: string): string {
  const w = toWall(iso, tz)
  return fromWall({ ...w, hour: 0, minute: 0, second: 0 }, tz)
}

/** Same wall-clock time, `n` calendar days later in `tz` (DST-aware). */
export function addDaysIn(iso: string, n: number, tz: string): string {
  const w = toWall(iso, tz)
  const shifted = new Date(Date.UTC(w.year, w.month - 1, w.day + n))
  return fromWall({
    ...w,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }, tz)
}

export function endOfDayIn(iso: string, tz: string): string {
  const w = toWall(iso, tz)
  return fromWall({ ...w, hour: 23, minute: 59, second: 59 }, tz)
}

// ── ICS date parsing ────────────────────────────────────────────────────────

export interface ParsedICSDate {
  iso: string
  isDate: boolean
  /** 'utc' (trailing Z), 'zoned' (TZID), or 'floating' (neither). */
  kind: 'utc' | 'zoned' | 'floating'
}

/**
 * Parse an ICS DATE or DATE-TIME. `zone` is the TZID (or the floating fallback);
 * `offsetResolver` handles TZIDs that are not IANA names (e.g. Windows names from
 * Outlook) by evaluating the file's own VTIMEZONE. Returns null when the value
 * is not a date, so one bad property never aborts the whole file.
 */
export function parseICSDateValue(
  value: string,
  opts: { isDateParam?: boolean; zone: string; offsetResolver?: (w: WallTime) => number | null },
): ParsedICSDate | null {
  const v = value.trim()
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
  if (dateOnly || opts.isDateParam) {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(v)
    if (!m) return null
    const w: WallTime = { year: +m[1]!, month: +m[2]!, day: +m[3]!, hour: 0, minute: 0, second: 0 }
    if (!validWall(w)) return null
    return { iso: fromWall(w, opts.zone), isDate: true, kind: 'floating' }
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i.exec(v)
  if (!m) return null
  const w: WallTime = {
    year: +m[1]!, month: +m[2]!, day: +m[3]!,
    hour: +m[4]!, minute: +m[5]!, second: m[6] ? +m[6] : 0,
  }
  if (!validWall(w)) return null
  if (m[7]) {
    return { iso: new Date(Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)).toISOString(), isDate: false, kind: 'utc' }
  }
  if (opts.offsetResolver) {
    const offsetMin = opts.offsetResolver(w)
    if (offsetMin !== null) {
      const ms = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - offsetMin * 60_000
      return { iso: new Date(ms).toISOString(), isDate: false, kind: 'zoned' }
    }
  }
  return { iso: fromWall(w, opts.zone), isDate: false, kind: 'zoned' }
}

function validWall(w: WallTime): boolean {
  return w.month >= 1 && w.month <= 12 && w.day >= 1 && w.day <= 31 && w.hour <= 23 && w.minute <= 59 && w.second <= 60
}

// ── RFC 5545 DURATION ───────────────────────────────────────────────────────

/**
 * Signed seconds for an RFC 5545 duration (`-PT15M`, `P1D`, `-P1W`, `PT1H30M`).
 * Also accepts the malformed `-PT1D` the reminder picker used to emit, so stored
 * events with it are repaired on export. Null when not a duration.
 */
export function parseDuration(value: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)D)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value.trim())
  if (!m) return null
  // Bare "P" / "PT" match the pattern with no components; they are not durations.
  if (!m[2] && !m[3] && !m[4] && !m[5] && !m[6] && !m[7]) return null
  const sign = m[1] === '-' ? -1 : 1
  const total =
    (+(m[2] ?? 0)) * 604800 +
    (+(m[3] ?? 0) + +(m[4] ?? 0)) * 86400 +
    (+(m[5] ?? 0)) * 3600 +
    (+(m[6] ?? 0)) * 60 +
    (+(m[7] ?? 0))
  return sign * total
}

/** Canonical RFC 5545 duration for signed seconds: days before the `T`, weeks when exact. */
export function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  let s = Math.abs(Math.round(seconds))
  if (s === 0) return 'PT0S'
  if (s % 604800 === 0) return `${sign}P${s / 604800}W`
  const days = Math.floor(s / 86400); s -= days * 86400
  const hours = Math.floor(s / 3600); s -= hours * 3600
  const minutes = Math.floor(s / 60); s -= minutes * 60
  let out = `${sign}P`
  if (days) out += `${days}D`
  if (hours || minutes || s) {
    out += 'T'
    if (hours) out += `${hours}H`
    if (minutes) out += `${minutes}M`
    if (s) out += `${s}S`
  }
  return out
}
