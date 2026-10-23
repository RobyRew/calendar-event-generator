import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import { openDatabase, setDatabaseForTests, type DB } from '@/server/db/client'
import { calendars, events as eventsTable, logtoSessions, memberships, shareLinks, users } from '@/server/db/schema'
import { HttpError } from '@/server/http'
import { createCalendar, createShareLink, getCalendar, MAX_CALENDARS_PER_USER, MAX_EVENTS_PER_CALENDAR, MAX_USER_CHARS, revokeShareLink, updateCalendar, upsertEvent } from '@/server/repo'
import { sqliteSessionStore } from '@/server/logto/sqlite-store'
import { normalizeEvent } from '@/lib/normalize'
import {
  fetchExternalCalendar, isPublicAddress, normalizeSourceUrl, refreshSubscription, setFetcherForTests, type Fetcher,
} from '@/server/subscriptions'
import { resetRateLimitsForTests } from '@/server/ratelimit'

// Second feature round (2026-10-22): moving events between calendars, external
// calendar subscriptions, synced preferences, account export and deletion.

vi.mock('@/server/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/auth')>()
  const { getDb } = await import('@/server/db/client')
  const { users } = await import('@/server/db/schema')
  const { eq } = await import('drizzle-orm')
  const lookup = (request: Request) => {
    const id = request.headers.get('x-test-user')
    const row = id ? getDb().select().from(users).where(eq(users.id, id)).get() : undefined
    return row ? { id: row.id, email: row.email, name: row.name } : null
  }
  return {
    ...actual,
    getAuth: () => ({ cookieName: '__Host-cg_sid' }),
    currentUser: async (request: Request) => lookup(request),
    requireUser: async (request: Request) => {
      const u = lookup(request)
      if (!u) throw new HttpError(401, 'unauthenticated')
      return u
    },
  }
})

const calendarsIndex = await import('../src/server-routes/api/calendars/index')
const eventsRoute = await import('../src/server-routes/api/calendars/events')
const importRoute = await import('../src/server-routes/api/calendars/import')
const moveRoute = await import('../src/server-routes/api/calendars/move')
const refreshRoute = await import('../src/server-routes/api/calendars/refresh')
const sharesIndex = await import('../src/server-routes/api/shares/index')
const acceptRoute = await import('../src/server-routes/api/share/accept')
const prefsIndex = await import('../src/server-routes/api/prefs/index')
const prefsSection = await import('../src/server-routes/api/prefs/section')
const accountRoute = await import('../src/server-routes/api/account/index')
const exportRoute = await import('../src/server-routes/api/account/export')
const feedRoute = await import('../src/server-routes/feed')

const ORIGIN = 'https://calendar.test'
process.env.PUBLIC_SITE_URL = ORIGIN

let db: DB
let cal1: string
let cal2: string

type Handler = (ctx: never) => Response | Promise<Response>
async function call(handler: Handler | undefined, opts: { user?: string; path: string; params?: Record<string, string>; method?: string; body?: unknown }) {
  const url = new URL(opts.path, ORIGIN)
  const headers = new Headers()
  if (opts.user) headers.set('x-test-user', opts.user)
  if (opts.body !== undefined) headers.set('content-type', 'application/json')
  const request = new Request(url, { method: opts.method ?? 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined })
  const deleted: string[] = []
  const cookies = { delete: (name: string) => deleted.push(name) }
  const res = await handler!({ request, url, params: opts.params ?? {}, cookies } as never)
  const text = await res.text()
  let json: Record<string, any> = {}
  try {
    json = JSON.parse(text)
  } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, text, json, deletedCookies: deleted }
}

const ics = (name: string, ...events: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', `X-WR-CALNAME:${name}`, ...events, 'END:VCALENDAR'].join('\r\n')
const vevent = (uid: string, summary: string, day = '20261224') =>
  ['BEGIN:VEVENT', `UID:${uid}`, 'DTSTAMP:20261001T000000Z', `DTSTART;VALUE=DATE:${day}`, `SUMMARY:${summary}`, 'END:VEVENT'].join('\r\n')

let served: { status: 200 | 304; body?: string; etag?: string } = { status: 200, body: ics('Holidays', vevent('h1', 'Christmas Eve'), vevent('h2', 'Christmas', '20261225')), etag: '"v1"' }
let fetches: { url: string; etag: string | null }[] = []
const stubFetcher: Fetcher = async (url, cond) => {
  fetches.push({ url, etag: cond.etag })
  if (served.status === 304) return { status: 304, etag: cond.etag, lastModified: null }
  return { status: 200, body: new TextEncoder().encode(served.body!), etag: served.etag ?? null, lastModified: null }
}

beforeEach(() => {
  const handle = openDatabase(':memory:')
  migrate(handle.db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  setDatabaseForTests(handle)
  db = handle.db
  for (const [id, name] of [['alice', 'Alice'], ['bob', 'Bob'], ['eve', 'Eve']]) {
    db.insert(users).values({ id: id!, logtoSub: `sub-${id}`, email: `${id}@example.test`, name: name!, createdAt: Date.now() }).run()
  }
  cal1 = createCalendar(db, 'alice', { name: 'Clinic', timezone: 'Europe/Bucharest' }).id
  cal2 = createCalendar(db, 'alice', { name: 'Home', timezone: 'Europe/Bucharest' }).id
  upsertEvent(db, cal1, normalizeEvent({ uid: 'weekly', summary: 'Weekly', startDate: '2026-10-20T07:00:00.000Z', endDate: '2026-10-20T08:00:00.000Z', recurrenceRule: { frequency: 'WEEKLY', interval: 1, count: 4 } }))
  upsertEvent(db, cal1, normalizeEvent({ uid: 'weekly', recurrenceId: '2026-10-27T07:00:00.000Z', summary: 'Weekly (moved)', startDate: '2026-10-27T09:00:00.000Z', endDate: '2026-10-27T10:00:00.000Z' }))
  upsertEvent(db, cal1, normalizeEvent({ uid: 'single', summary: 'Single', startDate: '2026-10-21T07:00:00.000Z', endDate: '2026-10-21T08:00:00.000Z' }))
  served = { status: 200, body: ics('Holidays', vevent('h1', 'Christmas Eve'), vevent('h2', 'Christmas', '20261225')), etag: '"v1"' }
  fetches = []
  setFetcherForTests(stubFetcher)
  resetRateLimitsForTests()
})

afterEach(() => setFetcherForTests(null))

const rows = (calendarId: string) => db.select().from(eventsTable).where(eq(eventsTable.calendarId, calendarId)).all()

describe('moving events between account calendars', () => {
  const move = (user: string, from: string, to: string, uids: string[]) =>
    call(moveRoute.POST, { user, path: `/api/calendars/${from}/move`, params: { id: from }, method: 'POST', body: { uids, targetCalendarId: to } })

  it('moves a recurring event with its override, keeping UID and data', async () => {
    const res = await move('alice', cal1, cal2, ['weekly'])
    expect(res.status).toBe(200)
    expect(res.json.events.map((e: any) => [e.uid, e.recurrenceId, e.calendarId])).toEqual([
      ['weekly', '', cal2],
      ['weekly', '2026-10-27T07:00:00.000Z', cal2],
    ])
    expect(rows(cal1).map((r) => r.uid)).toEqual(['single'])
    expect(rows(cal2)).toHaveLength(2)
  })

  it('refuses a UID the target already has, and moves nothing', async () => {
    upsertEvent(db, cal2, normalizeEvent({ uid: 'single', summary: 'Other single', startDate: '2026-10-21T07:00:00.000Z', endDate: '2026-10-21T08:00:00.000Z' }))
    const res = await move('alice', cal1, cal2, ['weekly', 'single'])
    expect(res.status).toBe(409)
    expect(res.json.error).toBe('uid_exists')
    expect(rows(cal1)).toHaveLength(3)
  })

  it('needs editor rights on both calendars', async () => {
    const bobs = createCalendar(db, 'bob', { name: 'Bob', timezone: 'UTC' }).id
    expect((await move('bob', cal1, bobs, ['single'])).status).toBe(404)
    expect((await move('alice', cal1, bobs, ['single'])).status).toBe(404)
    expect((await move('alice', cal1, cal1, ['single'])).status).toBe(400)
  })

  it('removes event-level invites and links that pointed at the old calendar', async () => {
    createShareLink(db, { calendarId: cal1, eventUid: 'single', permission: 'full', createdBy: 'alice' })
    db.insert(memberships).values({ resourceType: 'event', resourceId: `${cal1}/single`, userId: 'bob', role: 'editor', createdAt: Date.now() }).run()
    expect((await move('alice', cal1, cal2, ['single'])).status).toBe(200)
    expect(db.select().from(shareLinks).where(eq(shareLinks.eventUid, 'single')).all()).toEqual([])
    expect(db.select().from(memberships).where(eq(memberships.userId, 'bob')).all()).toEqual([])
  })
})

describe('subscriptions to external calendars', () => {
  const subscribe = (body: Record<string, unknown>, user = 'alice') =>
    call(calendarsIndex.POST, { user, path: '/api/calendars', method: 'POST', body })

  it('fetches once on creation, names the calendar from the feed and stores its events', async () => {
    const res = await subscribe({ sourceUrl: 'webcal://example.org/holidays.ics' })
    expect(res.status).toBe(201)
    expect(res.json.calendar).toMatchObject({ name: 'Holidays', sourceUrl: 'https://example.org/holidays.ics', fetchError: null, role: 'owner' })
    expect(fetches).toEqual([{ url: 'https://example.org/holidays.ics', etag: null }])
    expect(rows(res.json.calendar.id).map((r) => r.uid).sort()).toEqual(['h1', 'h2'])
  })

  it('reports a feed that cannot be fetched, without creating the calendar', async () => {
    served = { status: 200, body: '<html>not a calendar</html>' }
    const res = await subscribe({ sourceUrl: 'https://example.org/page' })
    expect(res.status).toBe(400)
    expect(res.json).toMatchObject({ error: 'fetch_failed', message: 'not_ics' })
    expect(db.select().from(calendars).all()).toHaveLength(2)
  })

  it('is read-only: no event writes, imports, moves in or out, or editor invites', async () => {
    const id = (await subscribe({ sourceUrl: 'https://example.org/h.ics' })).json.calendar.id
    const ev = { uid: 'x', summary: 'X', startDate: '2026-10-21T07:00:00.000Z', endDate: '2026-10-21T08:00:00.000Z' }
    expect((await call(eventsRoute.PUT, { user: 'alice', path: `/api/calendars/${id}/events`, params: { id }, method: 'PUT', body: ev })).json.error).toBe('read_only')
    expect((await call(eventsRoute.DELETE, { user: 'alice', path: `/api/calendars/${id}/events?uid=h1`, params: { id }, method: 'DELETE' })).json.error).toBe('read_only')
    expect((await call(importRoute.POST, { user: 'alice', path: `/api/calendars/${id}/import`, params: { id }, method: 'POST', body: { events: [ev] } })).json.error).toBe('read_only')
    expect((await call(moveRoute.POST, { user: 'alice', path: `/api/calendars/${cal1}/move`, params: { id: cal1 }, method: 'POST', body: { uids: ['single'], targetCalendarId: id } })).json.error).toBe('read_only')
    expect((await call(moveRoute.POST, { user: 'alice', path: `/api/calendars/${id}/move`, params: { id }, method: 'POST', body: { uids: ['h1'], targetCalendarId: cal1 } })).json.error).toBe('read_only')
    expect((await call(sharesIndex.POST, { user: 'alice', path: '/api/shares', method: 'POST', body: { calendarId: id, permission: 'edit' } })).json.error).toBe('read_only')
    // A read-only feed link still works.
    expect((await call(sharesIndex.POST, { user: 'alice', path: '/api/shares', method: 'POST', body: { calendarId: id, permission: 'full' } })).status).toBe(201)
  })

  it('refresh replaces the events, sends the stored ETag, and keeps the old events when the feed fails', async () => {
    const id = (await subscribe({ sourceUrl: 'https://example.org/h.ics' })).json.calendar.id
    db.update(calendars).set({ fetchedAt: 0 }).where(eq(calendars.id, id)).run()
    served = { status: 200, body: ics('Holidays', vevent('h3', 'New Year', '20270101')), etag: '"v2"' }
    const ok = await call(refreshRoute.POST, { user: 'alice', path: `/api/calendars/${id}/refresh`, params: { id }, method: 'POST', body: {} })
    expect(ok.json).toMatchObject({ ok: true, changed: true })
    expect(fetches.at(-1)!.etag).toBe('"v1"')
    expect(rows(id).map((r) => r.uid)).toEqual(['h3'])
    // Asked again within a minute: refused.
    expect((await call(refreshRoute.POST, { user: 'alice', path: `/api/calendars/${id}/refresh`, params: { id }, method: 'POST', body: {} })).status).toBe(429)
    db.update(calendars).set({ fetchedAt: 0 }).where(eq(calendars.id, id)).run()
    served = { status: 200, body: 'garbage' }
    const bad = await call(refreshRoute.POST, { user: 'alice', path: `/api/calendars/${id}/refresh`, params: { id }, method: 'POST', body: {} })
    expect(bad.json).toMatchObject({ ok: false, error: 'not_ics' })
    expect(bad.json.calendar.fetchError).toBe('not_ics')
    expect(rows(id).map((r) => r.uid)).toEqual(['h3'])
  })

  it('a refreshed subscription reaches its share-link feed', async () => {
    const id = (await subscribe({ sourceUrl: 'https://example.org/h.ics' })).json.calendar.id
    const token = createShareLink(db, { calendarId: id, eventUid: null, permission: 'full', createdBy: 'alice' }).token
    expect((await call(feedRoute.GET, { path: `/feed/${token}.ics`, params: { token } })).text).toContain('SUMMARY:Christmas Eve')
    db.update(calendars).set({ fetchedAt: 0 }).where(eq(calendars.id, id)).run()
    served = { status: 200, body: ics('Holidays', vevent('h9', 'Epiphany', '20270106')), etag: '"v9"' }
    await call(refreshRoute.POST, { user: 'alice', path: `/api/calendars/${id}/refresh`, params: { id }, method: 'POST', body: {} })
    const text = (await call(feedRoute.GET, { path: `/feed/${token}.ics`, params: { token } })).text
    expect(text).toContain('SUMMARY:Epiphany')
    expect(text).not.toContain('Christmas')
  })

  it('caps subscriptions per user', async () => {
    for (let i = 0; i < 20; i++) createCalendar(db, 'eve', { name: `s${i}`, sourceUrl: `https://example.org/${i}.ics` })
    expect((await subscribe({ sourceUrl: 'https://example.org/21.ics' }, 'eve')).json.error).toBe('too_many_subscriptions')
  })

  it('accepts only http(s) URLs without credentials', () => {
    expect(normalizeSourceUrl(' webcals://Example.org/a.ics#x ')).toBe('https://example.org/a.ics')
    for (const bad of ['file:///etc/passwd', 'ftp://example.org/a.ics', 'https://user:pw@example.org/a.ics', 'javascript:alert(1)', 'not a url']) {
      expect(() => normalizeSourceUrl(bad)).toThrow(HttpError)
    }
  })

  it('treats loopback, private, link-local, CGNAT and mapped addresses as non-public', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.104.12.30', '0.0.0.0', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::127.0.0.1', '224.0.0.1']) {
      expect(isPublicAddress(ip), ip).toBe(false)
    }
    for (const ip of ['1.1.1.1', '93.184.216.34', '2606:4700:4700::1111']) expect(isPublicAddress(ip), ip).toBe(true)
  })

  it('never connects to a server on this host, by IP, by name or through a redirect', async () => {
    let hits = 0
    const server = http.createServer((_req, res) => {
      hits++
      res.writeHead(200, { 'content-type': 'text/calendar' })
      res.end(ics('x'))
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
    const port = (server.address() as { port: number }).port
    try {
      for (const url of [`http://127.0.0.1:${port}/a.ics`, `http://localhost:${port}/a.ics`, `http://[::ffff:127.0.0.1]:${port}/a.ics`, `http://2130706433:${port}/a.ics`]) {
        // One code for blocked, unresolvable and refused hosts (no oracle on internal names).
        await expect(fetchExternalCalendar(url, { etag: null, lastModified: null }), url).rejects.toThrow('unreachable')
      }
      expect(hits).toBe(0)
    } finally {
      server.close()
    }
  })
})

describe('synced preferences', () => {
  const put = (section: string, value: unknown, baseVersion: number, user = 'alice') =>
    call(prefsSection.PUT, { user, path: `/api/prefs/${section}`, params: { section }, method: 'PUT', body: { value, baseVersion } })

  it('writes a section against the version it last saw, and returns the stored copy on a conflict', async () => {
    expect((await call(prefsIndex.GET, { user: 'alice', path: '/api/prefs' })).json.prefs).toEqual({})
    expect((await put('settings', { theme: 'dark' }, 0)).json.entry).toEqual({ value: { theme: 'dark' }, version: 1 })
    const stale = await put('settings', { theme: 'light' }, 0)
    expect(stale.status).toBe(409)
    expect(stale.json.entry).toEqual({ value: { theme: 'dark' }, version: 1 })
    expect((await put('settings', { theme: 'light' }, 1)).json.entry.version).toBe(2)
    expect((await call(prefsIndex.GET, { user: 'bob', path: '/api/prefs' })).json.prefs).toEqual({})
  })

  it('validates each section and refuses unknown ones', async () => {
    expect((await put('templates', [{ id: 't1', name: 'Gym', isBuiltIn: false }], 0)).status).toBe(200)
    expect((await put('templates', [{ id: 't2', isBuiltIn: true }], 1)).status).toBe(400)
    expect((await put('hidden', ['local', 'cal-1'], 0)).status).toBe(200)
    expect((await put('hidden', 'local', 1)).status).toBe(400)
    expect((await put('settings', { nested: { a: 1 } }, 0)).status).toBe(400)
    expect((await put('secrets', {}, 0)).status).toBe(404)
  })
})

describe('account export and deletion', () => {
  it('exports calendars, events, links and preferences, without share tokens', async () => {
    const link = createShareLink(db, { calendarId: cal1, eventUid: null, permission: 'busy', createdBy: 'alice' })
    const res = await call(exportRoute.GET, { user: 'alice', path: '/api/account/export' })
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="calgen-account-/)
    expect(res.json.user).toMatchObject({ id: 'alice', email: 'alice@example.test' })
    expect(res.json.calendars.map((c: any) => c.name)).toEqual(['Clinic', 'Home'])
    expect(res.json.calendars[0].events.map((e: any) => e.uid)).toContain('weekly')
    expect(res.json.calendars[0].shareLinks).toEqual([expect.objectContaining({ permission: 'busy' })])
    expect(res.text).not.toContain(link.token)
  })

  it('needs the typed confirmation', async () => {
    expect((await call(accountRoute.DELETE, { user: 'alice', path: '/api/account', method: 'DELETE', body: { confirm: 'yes' } })).status).toBe(400)
    expect(db.select().from(users).where(eq(users.id, 'alice')).get()).toBeTruthy()
  })

  it('deletes the user, their calendars, other people\'s access to them, and their sessions', async () => {
    const invite = createShareLink(db, { calendarId: cal1, eventUid: null, permission: 'edit', createdBy: 'alice' })
    expect((await call(acceptRoute.POST, { user: 'bob', path: `/api/share/${invite.token}/accept`, params: { token: invite.token }, method: 'POST', body: {} })).status).toBe(200)
    const bobsCal = createCalendar(db, 'bob', { name: 'Bob', timezone: 'UTC' }).id
    db.insert(memberships).values({ resourceType: 'calendar', resourceId: bobsCal, userId: 'alice', role: 'editor', createdAt: Date.now() }).run()
    const token = (sub: string) => `x.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.y`
    for (const [id, sub] of [['s-alice-1', 'sub-alice'], ['s-alice-2', 'sub-alice'], ['s-bob', 'sub-bob']]) {
      db.insert(logtoSessions).values({ id: id!, data: JSON.stringify({ idToken: token(sub!) }), createdAt: Date.now(), expiresAt: Date.now() + 1e9 }).run()
    }
    const res = await call(accountRoute.DELETE, { user: 'alice', path: '/api/account', method: 'DELETE', body: { confirm: 'DELETE' } })
    expect(res.status).toBe(200)
    expect(res.deletedCookies).toEqual(['__Host-cg_sid'])
    expect(db.select().from(users).where(eq(users.id, 'alice')).get()).toBeUndefined()
    expect(db.select().from(calendars).all().map((c) => c.id)).toEqual([bobsCal])
    expect(db.select().from(eventsTable).all()).toEqual([])
    expect(db.select().from(memberships).all()).toEqual([])
    expect(db.select().from(shareLinks).all()).toEqual([])
    expect(db.select().from(logtoSessions).all().map((s) => s.id)).toEqual(['s-bob'])
  })
})

describe('review fixes (2026-10-22)', () => {
  const subscribe = (body: Record<string, unknown>, user = 'alice') =>
    call(calendarsIndex.POST, { user, path: '/api/calendars', method: 'POST', body })

  it('refuses a feed with more events than a calendar may hold before parsing it', async () => {
    const tiny = (i: number) => `BEGIN:VEVENT\r\nUID:u${i}\r\nDTSTART;VALUE=DATE:20261224\r\nEND:VEVENT`
    served = { status: 200, body: ics('Bomb', ...Array.from({ length: MAX_EVENTS_PER_CALENDAR + 1 }, (_, i) => tiny(i))) }
    const t0 = Date.now()
    const res = await subscribe({ sourceUrl: 'https://example.org/bomb.ics' })
    expect(res.json).toMatchObject({ error: 'fetch_failed', message: 'too_large' })
    // Counting VEVENT lines is cheap; parsing and inserting 10,001 events was not.
    expect(Date.now() - t0).toBeLessThan(1500)
  })

  it('a refresh working from a stale row does not fetch a subscription another refresh has claimed', async () => {
    const id = (await subscribe({ sourceUrl: 'https://example.org/h.ics' })).json.calendar.id
    const stale = getCalendar(db, id)!
    db.update(calendars).set({ fetchedAt: stale.fetchedAt! + 5 }).where(eq(calendars.id, id)).run() // another refresh claimed it
    const before = fetches.length
    expect(await refreshSubscription(db, stale)).toMatchObject({ ok: true, changed: false })
    expect(fetches.length).toBe(before)
  })

  it('changing a subscription\'s time zone makes the next refresh fetch and parse again', async () => {
    const id = (await subscribe({ sourceUrl: 'https://example.org/h.ics' })).json.calendar.id
    expect(getCalendar(db, id)!.sourceEtag).toBe('"v1"')
    updateCalendar(db, id, { timezone: 'America/New_York' })
    expect(getCalendar(db, id)).toMatchObject({ sourceEtag: null, sourceLastModified: null, fetchedAt: null })
  })

  it('moves send createOnly: the import refuses a UID the calendar already has, and writes nothing', async () => {
    const ev = { uid: 'single', summary: 'Device copy', startDate: '2026-10-21T07:00:00.000Z', endDate: '2026-10-21T08:00:00.000Z' }
    const res = await call(importRoute.POST, { user: 'alice', path: `/api/calendars/${cal1}/import`, params: { id: cal1 }, method: 'POST', body: { events: [ev, { ...ev, uid: 'fresh' }], createOnly: true } })
    expect(res.status).toBe(409)
    expect(res.json.error).toBe('uid_exists')
    expect(rows(cal1).map((r) => r.uid).sort()).toEqual(['single', 'weekly', 'weekly'])
  })

  it('bulk-deletes whole events in one request', async () => {
    const deleteRoute = await import('../src/server-routes/api/calendars/delete-events')
    const res = await call(deleteRoute.POST, { user: 'alice', path: `/api/calendars/${cal1}/delete-events`, params: { id: cal1 }, method: 'POST', body: { uids: ['weekly', 'single'] } })
    expect(res.json.deleted).toBe(3)
    expect(rows(cal1)).toEqual([])
    expect((await call(deleteRoute.POST, { user: 'bob', path: `/api/calendars/${cal1}/delete-events`, params: { id: cal1 }, method: 'POST', body: { uids: ['x'] } })).status).toBe(404)
  })

  it('the export streams valid JSON with revoked links and the user\'s links on others\' calendars, and is throttled', async () => {
    const old = createShareLink(db, { calendarId: cal1, eventUid: null, permission: 'busy', label: 'old link', createdBy: 'alice' })
    revokeShareLink(db, old.id)
    const bobs = createCalendar(db, 'bob', { name: 'Bob', timezone: 'UTC' }).id
    const invite = createShareLink(db, { calendarId: bobs, eventUid: null, permission: 'edit', createdBy: 'bob' })
    expect((await call(acceptRoute.POST, { user: 'alice', path: `/api/share/${invite.token}/accept`, params: { token: invite.token }, method: 'POST', body: {} })).status).toBe(200)
    const res = await call(exportRoute.GET, { user: 'alice', path: '/api/account/export' })
    expect(res.json.calendars[0].shareLinks).toEqual([expect.objectContaining({ label: 'old link', revokedAt: expect.any(String) })])
    expect(res.json.myLinksElsewhere).toEqual([expect.objectContaining({ calendarId: bobs, personal: true, permission: 'full' })])
    expect(res.text).not.toContain(invite.token)
    expect((await call(exportRoute.GET, { user: 'alice', path: '/api/account/export' })).status).toBe(200)
    expect((await call(exportRoute.GET, { user: 'alice', path: '/api/account/export' })).status).toBe(429)
  })

  it('account deletion parses only signed-in sessions and drops expired ones', async () => {
    const tok = (sub: string) => `x.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.y`
    const now = Date.now()
    db.insert(logtoSessions).values([
      { id: 'pre-login', data: JSON.stringify({ signInSession: 'x' }), createdAt: now, expiresAt: now + 1e9 },
      { id: 'expired', data: JSON.stringify({ idToken: tok('sub-bob') }), createdAt: now, expiresAt: now - 1 },
      { id: 'alice', data: JSON.stringify({ idToken: tok('sub-alice') }), createdAt: now, expiresAt: now + 1e9 },
    ]).run()
    expect((await call(accountRoute.DELETE, { user: 'alice', path: '/api/account', method: 'DELETE', body: { confirm: 'DELETE' } })).status).toBe(200)
    expect(db.select().from(logtoSessions).all().map((s) => s.id)).toEqual(['pre-login'])
  })

  it('an unresolvable host name reports the same code as a blocked one', async () => {
    await expect(fetchExternalCalendar('https://does-not-exist.invalid/a.ics', { etag: null, lastModified: null })).rejects.toThrow('unreachable')
  })
})

describe('second review fixes (2026-10-22)', () => {
  const subscribe = (body: Record<string, unknown>, user = 'alice') =>
    call(calendarsIndex.POST, { user, path: '/api/calendars', method: 'POST', body })

  it('the event limit holds however the BEGIN:VEVENT line is written', async () => {
    for (const begin of ['BEGIN:VEV\r\n ENT', 'BEGIN;X=1:VEVENT', 'begin: vevent']) {
      resetRateLimitsForTests()
      const ev = (i: number) => `${begin}\r\nUID:u${i}\r\nDTSTART;VALUE=DATE:20261224\r\nEND:VEVENT`
      served = { status: 200, body: ics('Bomb', ...Array.from({ length: MAX_EVENTS_PER_CALENDAR + 1 }, (_, i) => ev(i))) }
      const t0 = Date.now()
      expect((await subscribe({ sourceUrl: 'https://example.org/bomb.ics' })).json, begin).toMatchObject({ error: 'fetch_failed', message: 'too_large' })
      expect(Date.now() - t0, begin).toBeLessThan(2500)
    }
  })

  it('a time zone change during a refresh is not undone by that refresh', async () => {
    const id = (await subscribe({ sourceUrl: 'https://example.org/h.ics' })).json.calendar.id
    db.update(calendars).set({ fetchedAt: 0 }).where(eq(calendars.id, id)).run()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    setFetcherForTests(async () => {
      await gate
      return { status: 200, body: new TextEncoder().encode(ics('Holidays', vevent('late', 'Late'))), etag: '"v9"', lastModified: null }
    })
    const refreshing = refreshSubscription(db, getCalendar(db, id)!)
    updateCalendar(db, id, { timezone: 'America/New_York' })
    release()
    expect(await refreshing).toMatchObject({ changed: false })
    expect(getCalendar(db, id)).toMatchObject({ sourceEtag: null, fetchedAt: null })
    expect(rows(id).map((r) => r.uid).sort()).toEqual(['h1', 'h2'])
  })

  it('sessions record their subject, and account deletion removes them by it', async () => {
    const tok = (sub: string) => `x.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.y`
    const { sqlite } = (await import('@/server/db/client')).getDatabase()
    const store = sqliteSessionStore(sqlite, { subjectColumn: 'subject' })
    store.save('s-alice', { idToken: tok('sub-alice') }, Date.now() + 1e9)
    store.save('s-pre', { signInSession: 'x' }, Date.now() + 1e9)
    store.save('s-bob', { idToken: tok('sub-bob') }, Date.now() + 1e9)
    // A row from before the subject column existed.
    db.insert(logtoSessions).values({ id: 's-legacy', data: JSON.stringify({ idToken: tok('sub-alice') }), createdAt: Date.now(), expiresAt: Date.now() + 1e9 }).run()
    expect(db.select().from(logtoSessions).all().map((r) => [r.id, r.subject]).sort()).toEqual([['s-alice', 'sub-alice'], ['s-bob', 'sub-bob'], ['s-legacy', null], ['s-pre', '']])
    expect((await call(accountRoute.DELETE, { user: 'alice', path: '/api/account', method: 'DELETE', body: { confirm: 'DELETE' } })).status).toBe(200)
    expect(db.select().from(logtoSessions).all().map((r) => r.id).sort()).toEqual(['s-bob', 's-pre'])
  })

  it('caps the calendars a user owns and the data across them', async () => {
    for (let i = 0; i < MAX_CALENDARS_PER_USER; i++) createCalendar(db, 'eve', { name: `c${i}`, timezone: 'UTC' })
    expect((await call(calendarsIndex.POST, { user: 'eve', path: '/api/calendars', method: 'POST', body: { name: 'one more' } })).json.error).toBe('too_many_calendars')
    // Alice's calendars already hold MAX_USER_CHARS between them (sizes recorded, data kept small).
    const now = Date.now()
    const per = Math.ceil(MAX_USER_CHARS / 5)
    for (let i = 0; i < 5; i++) {
      const c = createCalendar(db, 'alice', { name: `big${i}`, timezone: 'UTC' }).id
      db.insert(eventsTable).values({ id: `big${i}`, calendarId: c, uid: `big${i}`, recurrenceId: '', data: '{}', size: per, sequence: 0, startsAt: now, endsAt: now, createdAt: now, updatedAt: now }).run()
    }
    const res = await call(eventsRoute.PUT, { user: 'alice', path: `/api/calendars/${cal2}/events`, params: { id: cal2 }, method: 'PUT', body: { uid: 'n', summary: 'n', startDate: '2026-10-21T07:00:00.000Z', endDate: '2026-10-21T08:00:00.000Z' } })
    expect(res.status).toBe(413)
    expect(res.json.error).toBe('account_full')
  })

  it('a HEAD request does not hold up later exports or use up the rate limit', async () => {
    const req = (method: string) => ({ request: new Request(`${ORIGIN}/api/account/export`, { method, headers: { 'x-test-user': 'alice' } }), url: new URL(`${ORIGIN}/api/account/export`), params: {} }) as never
    const head = await exportRoute.GET(req('HEAD'))
    expect(head.status).toBe(200)
    expect(head.headers.get('content-disposition')).toMatch(/^attachment/)
    expect((await call(exportRoute.GET, { user: 'alice', path: '/api/account/export' })).status).toBe(200)
    expect((await call(exportRoute.GET, { user: 'alice', path: '/api/account/export' })).status).toBe(200)
  })
})

describe('third review fixes (2026-10-22)', () => {
  const subscribe = (body: Record<string, unknown>, user = 'alice') =>
    call(calendarsIndex.POST, { user, path: '/api/calendars', method: 'POST', body })

  it('bounds the date values a feed may hold, not only its events', async () => {
    const days = Array.from({ length: 60_000 }, (_, i) => new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString().replace(/[-:]/g, '').slice(0, 15))
    const exdates = days.map((d) => `EXDATE:${d}`)
    served = { status: 200, body: ics('Dense', ['BEGIN:VEVENT', 'UID:dense', 'DTSTAMP:20261001T000000Z', 'DTSTART:20260101T000000', 'RRULE:FREQ=HOURLY', ...exdates, 'END:VEVENT'].join('\r\n')) }
    expect((await subscribe({ sourceUrl: 'https://example.org/dense.ics' })).json).toMatchObject({ error: 'fetch_failed', message: 'too_large' })
  })

  it('a full 10,000-event feed with the usual date properties stays within the date budget', async () => {
    const full = (i: number) => ['BEGIN:VEVENT', `UID:f${i}`, 'DTSTAMP:20261001T000000Z', 'CREATED:20261001T000000Z', 'LAST-MODIFIED:20261001T000000Z',
      'DTSTART;TZID=Europe/Madrid:20261224T100000', 'DTEND;TZID=Europe/Madrid:20261224T110000', `SUMMARY:e${i}`, 'END:VEVENT'].join('\r\n')
    served = { status: 200, body: ics('Full', ...Array.from({ length: MAX_EVENTS_PER_CALENDAR }, (_, i) => full(i))), etag: '"f"' }
    const res = await subscribe({ sourceUrl: 'https://example.org/full.ics' })
    expect(res.status).toBe(201)
    expect(rows(res.json.calendar.id)).toHaveLength(MAX_EVENTS_PER_CALENDAR)
  })

  it('a full account is reported as such to subscriptions, not as a feed that is too large', async () => {
    const now = Date.now()
    const per = Math.ceil(MAX_USER_CHARS / 5)
    for (let i = 0; i < 5; i++) {
      const c = createCalendar(db, 'alice', { name: `big${i}`, timezone: 'UTC' }).id
      db.insert(eventsTable).values({ id: `big${i}`, calendarId: c, uid: `big${i}`, recurrenceId: '', data: '{}', size: per, sequence: 0, startsAt: now, endsAt: now, createdAt: now, updatedAt: now }).run()
    }
    expect((await subscribe({ sourceUrl: 'https://example.org/h.ics' })).json).toMatchObject({ error: 'fetch_failed', message: 'account_full' })
  })
})

describe('fourth review fixes (2026-10-24)', () => {
  it('refuses deeply nested components quickly instead of scanning them', async () => {
    const begins = Array.from({ length: 900 }, () => 'BEGIN:X').join('\r\n')
    const ends = Array.from({ length: 200_000 }, () => 'END:Y').join('\r\n')
    served = { status: 200, body: ['BEGIN:VCALENDAR', 'VERSION:2.0', begins, ends, 'END:VCALENDAR'].join('\r\n') }
    const t0 = Date.now()
    const res = await call(calendarsIndex.POST, { user: 'alice', path: '/api/calendars', method: 'POST', body: { sourceUrl: 'https://example.org/deep.ics' } })
    expect(res.json).toMatchObject({ error: 'fetch_failed', message: 'too_large' })
    expect(Date.now() - t0).toBeLessThan(1500)
  })

  it('bulk delete with masterOnly keeps the overrides', async () => {
    const deleteRoute = await import('../src/server-routes/api/calendars/delete-events')
    const res = await call(deleteRoute.POST, { user: 'alice', path: `/api/calendars/${cal1}/delete-events`, params: { id: cal1 }, method: 'POST', body: { uids: ['weekly'], masterOnly: true } })
    expect(res.json.deleted).toBe(1)
    expect(rows(cal1).map((r) => [r.uid, r.recurrenceId]).sort()).toEqual([['single', ''], ['weekly', '2026-10-27T07:00:00.000Z']])
  })
})
