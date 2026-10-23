import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { BlockList, isIP } from 'node:net'
import { and, asc, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { CalendarEvent } from '@/types'
import { ParseLimitError, parseICSBytes } from '@/lib/ics-parser'
import type { DB } from './db/client'
import { calendars, events, type CalendarRow } from './db/schema'
import { HttpError } from './http'
import { assertCalendarWithinBounds, MAX_EVENT_CHARS, MAX_EVENTS_PER_CALENDAR, toStoredEvent, touchCalendar } from './repo'
import { randomUUID } from 'node:crypto'

// Subscriptions to external calendars: a read-only account calendar whose events
// the server replaces with the contents of an .ics URL (public holidays, another
// provider's published calendar). The server fetches URLs a user typed in, so
// every request is guarded against reaching this host or its private networks:
// only http(s), every resolved address checked against the ranges below (also
// after each redirect), a size cap and a timeout.

export const MAX_SUBSCRIPTIONS_PER_USER = 20
export const SUBSCRIPTION_MAX_BYTES = 5 * 1024 * 1024
export const SUBSCRIPTION_TIMEOUT_MS = 15_000
/** How often the background job refreshes a subscription. */
export const REFRESH_EVERY_MS = 3 * 3_600_000
/** Shortest gap between two refreshes of one subscription asked for by its owner. */
export const MANUAL_REFRESH_MIN_MS = 60_000
const MAX_REDIRECTS = 3
/**
 * Date work per feed (see ParseOptions.maxDateWork): a 10,000-event feed with zoned
 * DTSTART/DTEND and UTC DTSTAMP/CREATED/LAST-MODIFIED costs about 90,000.
 */
export const MAX_DATE_WORK = 150_000

/** A subscription URL as it will be fetched: webcal(s) becomes https; only http(s), no credentials. */
export function normalizeSourceUrl(raw: string): string {
  const text = raw.trim().replace(/^webcals?:\/\//i, 'https://')
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new HttpError(400, 'invalid_url')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new HttpError(400, 'invalid_url')
  if (url.username || url.password) throw new HttpError(400, 'invalid_url')
  if (url.href.length > 2048) throw new HttpError(400, 'invalid_url')
  url.hash = ''
  return url.href
}

// Loopback, private, link-local, CGNAT (Tailscale lives in 100.64/10), multicast,
// documentation and other reserved ranges. BlockList checks an IPv4-mapped IPv6
// address (::ffff:127.0.0.1, ::ffff:7f00:1) against the IPv4 rules.
const blocked = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of [
  ['::', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 23],
  ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
] as const) blocked.addSubnet(net, prefix, 'ipv6')

/** True for an address on the public internet; false for anything this server could reach privately. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  if (family === 6) return !blocked.check(address, 'ipv6')
  return false
}

/**
 * dns.lookup that refuses names resolving to a non-public address. Every address
 * a name resolves to must be public, so a record mixing a public and a private
 * address cannot slip through on the second try.
 */
function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number | string },
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
): void {
  dnsLookup(hostname, { all: true, family: options.family as never }, (err, addresses) => {
    if (err) return callback(err, '')
    const list = addresses as LookupAddress[]
    if (list.length === 0 || list.some((a) => !isPublicAddress(a.address))) {
      const e = new Error('blocked address') as NodeJS.ErrnoException
      e.code = 'EBLOCKED'
      return callback(e, '')
    }
    if (options.all) return callback(null, list)
    callback(null, list[0]!.address, list[0]!.family)
  })
}

export interface FetchResult {
  status: 200 | 304
  body?: Uint8Array
  etag: string | null
  lastModified: string | null
}

export class FetchError extends Error {}

export type Fetcher = (url: string, conditional: { etag: string | null; lastModified: string | null }) => Promise<FetchResult>

function requestOnce(url: URL, headers: Record<string, string>, deadline: number): Promise<{ status: number; headers: http.IncomingHttpHeaders; body?: Uint8Array }> {
  return new Promise((resolve, reject) => {
    // IP literals skip DNS, so they are checked here; names go through guardedLookup.
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host) && !isPublicAddress(host)) return reject(new FetchError('unreachable'))
    let settled = false
    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }
    // A blocked address, a name that does not resolve and a refused connection all
    // report 'unreachable': distinct codes told users which internal host names
    // exist on the server's network. The specific reason is only logged.
    const fail = (e: unknown) => done(() => {
      if (!(e instanceof FetchError)) console.warn('[subscriptions] fetch failed:', (e as NodeJS.ErrnoException)?.code ?? e)
      reject(e instanceof FetchError ? e : new FetchError('unreachable'))
    })
    const mod = url.protocol === 'https:' ? https : http
    // agent: false — a fresh socket per request, never pooled, closed with the request.
    const req = mod.request(url, { method: 'GET', headers, lookup: guardedLookup as never, agent: false }, (res) => {
      const status = res.statusCode ?? 0
      if (status !== 200) {
        // Redirects and errors need only their headers. Reading the body after
        // resolving ran past the deadline and the size cap, and kept the socket open.
        const headers = res.headers
        res.destroy()
        req.destroy()
        return done(() => resolve({ status, headers }))
      }
      const declared = Number(res.headers['content-length'] ?? '0')
      // fail() before destroy(): destroying emits 'aborted' at once, which would
      // otherwise report the oversized feed as unreachable.
      if (declared > SUBSCRIPTION_MAX_BYTES) {
        fail(new FetchError('too_large'))
        return res.destroy()
      }
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > SUBSCRIPTION_MAX_BYTES) {
          fail(new FetchError('too_large'))
          return res.destroy()
        }
        chunks.push(chunk)
      })
      res.on('end', () => done(() => resolve({ status, headers: res.headers, body: new Uint8Array(Buffer.concat(chunks)) })))
      res.on('error', fail)
      res.on('aborted', () => fail(new FetchError('unreachable')))
    })
    // One deadline for the whole exchange, so a server dripping bytes cannot hold it open.
    const timer = setTimeout(() => {
      fail(new FetchError('timeout'))
      req.destroy()
    }, Math.max(1, deadline - Date.now()))
    req.on('error', fail)
    req.end()
  })
}

/** GET an external calendar with the guards above; follows up to three redirects, each one checked again. */
export const fetchExternalCalendar: Fetcher = async (start, conditional) => {
  const deadline = Date.now() + SUBSCRIPTION_TIMEOUT_MS
  let url = new URL(normalizeSourceUrl(start))
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const headers: Record<string, string> = {
      'user-agent': 'CalGen calendar subscriptions (+https://calendar.robyrew.com)',
      accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5',
      // No compression: a compressed body could expand past the size cap.
      'accept-encoding': 'identity',
    }
    if (conditional.etag) headers['if-none-match'] = conditional.etag
    if (conditional.lastModified) headers['if-modified-since'] = conditional.lastModified
    const res = await requestOnce(url, headers, deadline)
    if (res.status >= 300 && res.status < 400 && res.status !== 304) {
      const location = res.headers.location
      if (!location) throw new FetchError(`http_${res.status}`)
      let next: URL
      try {
        next = new URL(normalizeSourceUrl(new URL(location, url).href))
      } catch {
        throw new FetchError('invalid_redirect')
      }
      url = next
      continue
    }
    const etag = typeof res.headers.etag === 'string' ? res.headers.etag : null
    const lastModified = typeof res.headers['last-modified'] === 'string' ? res.headers['last-modified'] : null
    if (res.status === 304) return { status: 304, etag: etag ?? conditional.etag, lastModified: lastModified ?? conditional.lastModified }
    if (res.status !== 200) throw new FetchError(`http_${res.status}`)
    return { status: 200, body: res.body, etag, lastModified }
  }
  throw new FetchError('too_many_redirects')
}

let fetcher: Fetcher = fetchExternalCalendar

/** Tests: replace the network fetch. */
export function setFetcherForTests(f: Fetcher | null): void {
  fetcher = f ?? fetchExternalCalendar
}

/** The events of an .ics body as they would be stored, or a FetchError code. */
export function eventsFromBody(body: Uint8Array, timezone: string): { events: CalendarEvent[]; name: string | null } {
  const head = new TextDecoder().decode(body.subarray(0, 4096))
  if (!/BEGIN:VCALENDAR/i.test(head)) throw new FetchError('not_ics')
  // Parsing runs on the request thread, so its work is bounded: the parser stops
  // once the feed has more events than a calendar may hold (83,000 tiny events in
  // 5 MB took ~6 s), or more date work than MAX_DATE_WORK (one event with
  // 300,000 EXDATEs took as long), or nests components too deep.
  let parsed: ReturnType<typeof parseICSBytes>
  try {
    parsed = parseICSBytes(body, { defaultTimezone: timezone, maxEvents: MAX_EVENTS_PER_CALENDAR, maxDateWork: MAX_DATE_WORK })
  } catch (err) {
    if (err instanceof ParseLimitError) throw new FetchError('too_large')
    throw err
  }
  // One row per UID + RECURRENCE-ID: a later duplicate in the feed replaces an earlier one.
  const byKey = new Map<string, CalendarEvent>()
  for (const e of parsed.events) byKey.set(`${e.uid}\u0000${e.recurrenceId}`, toStoredEvent(e))
  return { events: [...byKey.values()], name: parsed.meta.calendarName?.trim() || null }
}

/** Replace a subscription calendar's events (one transaction; over the size bounds it throws and nothing changes). */
function replaceEvents(db: DB, calendarId: string, list: CalendarEvent[], now: number): void {
  db.transaction(() => {
    db.delete(events).where(eq(events.calendarId, calendarId)).run()
    const rows = []
    for (const e of list) {
      const data = JSON.stringify(e)
      if (data.length > MAX_EVENT_CHARS) continue // one oversized event does not block the rest
      rows.push({
        id: randomUUID(),
        calendarId,
        uid: e.uid,
        recurrenceId: e.recurrenceId,
        data,
        size: data.length,
        sequence: e.sequence,
        startsAt: Date.parse(e.startDate),
        endsAt: Date.parse(e.endDate),
        createdAt: now,
        updatedAt: now,
      })
    }
    for (let i = 0; i < rows.length; i += 500) db.insert(events).values(rows.slice(i, i + 500)).run()
    assertCalendarWithinBounds(db, calendarId)
    touchCalendar(db, calendarId, now)
  })
}

export interface RefreshResult {
  ok: boolean
  error: string | null
  changed: boolean
  name: string | null
}

/** Fetch a subscription now and store the result (or the error, keeping the previous events). */
export async function refreshSubscription(db: DB, calendar: CalendarRow, now = Date.now()): Promise<RefreshResult> {
  if (!calendar.sourceUrl) throw new HttpError(400, 'not_a_subscription')
  // Claim the slot first, so the background job and a manual refresh never fetch
  // it twice at once: the claim only succeeds while fetched_at still has the value
  // this caller read (a snapshot taken before another refresh started fails it).
  const claimed = db
    .update(calendars)
    .set({ fetchedAt: now })
    .where(and(eq(calendars.id, calendar.id), calendar.fetchedAt === null ? isNull(calendars.fetchedAt) : eq(calendars.fetchedAt, calendar.fetchedAt)))
    .run()
  if (claimed.changes === 0) return { ok: true, error: null, changed: false, name: null }
  // While the fetch was out, the claim may have been reset (a time zone change
  // clears fetched_at so the feed is parsed again) or taken by another refresh;
  // then this result is stale and nothing is written. The writes below run
  // synchronously, so checking right after the await is enough.
  const stillOurs = () => db.select({ f: calendars.fetchedAt }).from(calendars).where(eq(calendars.id, calendar.id)).get()?.f === now
  const gone: RefreshResult = { ok: true, error: null, changed: false, name: null }
  try {
    const res = await fetcher(calendar.sourceUrl, { etag: calendar.sourceEtag, lastModified: calendar.sourceLastModified })
    if (!stillOurs()) return gone
    if (res.status === 304) {
      db.update(calendars).set({ fetchError: null, fetchedAt: now }).where(eq(calendars.id, calendar.id)).run()
      return { ok: true, error: null, changed: false, name: null }
    }
    const { events: list, name } = eventsFromBody(res.body!, calendar.timezone)
    try {
      replaceEvents(db, calendar.id, list, now)
    } catch (err) {
      // The owner's whole account being full is not the feed being too large.
      if (err instanceof HttpError && err.status === 413) throw new FetchError(err.code === 'account_full' ? 'account_full' : 'too_large')
      throw err
    }
    db.update(calendars)
      .set({ fetchError: null, fetchedAt: now, sourceEtag: res.etag, sourceLastModified: res.lastModified })
      .where(eq(calendars.id, calendar.id))
      .run()
    return { ok: true, error: null, changed: true, name }
  } catch (err) {
    if (!stillOurs()) return gone
    const code = err instanceof FetchError ? err.message : 'parse_error'
    if (!(err instanceof FetchError)) console.error('[subscriptions] refresh failed:', err)
    db.update(calendars).set({ fetchError: code, fetchedAt: now }).where(eq(calendars.id, calendar.id)).run()
    return { ok: false, error: code, changed: false, name: null }
  }
}

export function countSubscriptions(db: DB, ownerId: string): number {
  return db
    .select({ n: sql<number>`count(*)` })
    .from(calendars)
    .where(and(eq(calendars.ownerId, ownerId), isNotNull(calendars.sourceUrl)))
    .get()?.n ?? 0
}

/** Subscriptions due for a refresh, oldest first. */
export function dueSubscriptions(db: DB, now = Date.now(), limit = 20): CalendarRow[] {
  return db
    .select()
    .from(calendars)
    .where(and(isNotNull(calendars.sourceUrl), or(isNull(calendars.fetchedAt), lt(calendars.fetchedAt, now - REFRESH_EVERY_MS))))
    .orderBy(asc(calendars.fetchedAt))
    .limit(limit)
    .all()
}

let timer: ReturnType<typeof setInterval> | null = null
let running = false

/** Refresh due subscriptions every ten minutes, one at a time (single server process). */
export function startSubscriptionRefresher(getDb: () => DB): void {
  if (timer) return
  const tick = async () => {
    if (running) return
    running = true
    try {
      const db = getDb()
      for (const cal of dueSubscriptions(db)) await refreshSubscription(db, cal)
    } catch (err) {
      console.error('[subscriptions] background refresh failed:', err)
    } finally {
      running = false
    }
  }
  timer = setInterval(tick, 10 * 60_000)
  timer.unref?.()
  setTimeout(tick, 30_000).unref?.()
}
