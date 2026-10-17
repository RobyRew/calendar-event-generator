import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import { openDatabase, setDatabaseForTests, type DB } from '@/server/db/client'
import { users } from '@/server/db/schema'
import { HttpError } from '@/server/http'
import { createCalendar, createShareLink, listShareLinks, upsertEvent } from '@/server/repo'
import { normalizeEvent } from '@/lib/normalize'

// Route handlers run as-is; only "who is signed in" is stubbed (x-test-user header).
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
    getAuth: () => null,
    currentUser: async (request: Request) => lookup(request),
    requireUser: async (request: Request) => {
      const u = lookup(request)
      if (!u) throw new HttpError(401, 'unauthenticated')
      return u
    },
  }
})

const calendarsIndex = await import('../src/server-routes/api/calendars/index')
const calendarRoute = await import('../src/server-routes/api/calendars/calendar')
const eventsRoute = await import('../src/server-routes/api/calendars/events')
const membersRoute = await import('../src/server-routes/api/calendars/members')
const sharesIndex = await import('../src/server-routes/api/shares/index')
const shareRoute = await import('../src/server-routes/api/shares/share')
const rotateRoute = await import('../src/server-routes/api/shares/rotate')
const acceptRoute = await import('../src/server-routes/api/share/accept')
const sharedRoute = await import('../src/server-routes/api/shared')
const feedRoute = await import('../src/server-routes/feed')

const ORIGIN = 'https://calendar.test'
process.env.PUBLIC_SITE_URL = ORIGIN

let db: DB

function addUser(id: string, name: string) {
  db.insert(users).values({ id, logtoSub: `sub-${id}`, email: `${id}@example.test`, name, createdAt: Date.now() }).run()
}

type Handler = (ctx: never) => Response | Promise<Response>
async function call(handler: Handler | undefined, opts: { user?: string; path: string; params?: Record<string, string>; method?: string; body?: unknown; headers?: Record<string, string> }) {
  const url = new URL(opts.path, ORIGIN)
  const headers = new Headers(opts.headers)
  if (opts.user) headers.set('x-test-user', opts.user)
  if (opts.body !== undefined) headers.set('content-type', 'application/json')
  const request = new Request(url, { method: opts.method ?? 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined })
  const res = await handler!({ request, url, params: opts.params ?? {} } as never)
  const text = await res.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, text, json: json as Record<string, any> }
}

let calendarId: string

beforeEach(() => {
  const handle = openDatabase(':memory:')
  migrate(handle.db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  setDatabaseForTests(handle)
  db = handle.db
  addUser('alice', 'Alice')  // owner
  addUser('bob', 'Bob')      // joins the calendar through an editor invite
  addUser('dana', 'Dana')    // joins one event through an editor invite
  addUser('eve', 'Eve')      // no access
  calendarId = createCalendar(db, 'alice', { name: 'Clinic', description: 'Private clinic calendar', timezone: 'Europe/Bucharest' }).id
  upsertEvent(db, calendarId, normalizeEvent({
    uid: 'doctor', summary: 'Doctor', description: 'Room 4', timezone: 'Europe/Bucharest',
    startDate: '2026-10-20T07:00:00.000Z', endDate: '2026-10-20T08:00:00.000Z',
    location: { text: 'Clinic, Str. Lunga 1' },
    organizer: { name: 'Alice', email: 'alice@example.test' },
    alarms: [{ uid: 'a', action: 'DISPLAY', trigger: '-PT15M', triggerRelation: 'START', description: 'x', isDefault: false }],
  }))
  upsertEvent(db, calendarId, normalizeEvent({ uid: 'lunch', summary: 'Lunch (free)', transparency: 'TRANSPARENT', startDate: '2026-10-20T09:00:00.000Z', endDate: '2026-10-20T10:00:00.000Z' }))
})

async function invite(eventUid: string | null) {
  const res = await call(sharesIndex.POST, { user: 'alice', path: '/api/shares', method: 'POST', body: { calendarId, eventUid, permission: 'edit' } })
  expect(res.status).toBe(201)
  return res.json.share.links.page.split('/s/')[1] as string
}

async function accept(user: string, token: string) {
  return call(acceptRoute.POST, { user, path: `/api/share/${token}/accept`, method: 'POST', body: {}, params: { token } })
}

async function feed(token: string, headers: Record<string, string> = {}) {
  return call(feedRoute.GET, { path: `/feed/${token}.ics`, params: { token }, headers })
}

describe('authorization matrix', () => {
  beforeEach(async () => {
    expect((await accept('bob', await invite(null))).status).toBe(200)
    expect((await accept('dana', await invite('doctor'))).status).toBe(200)
  })

  const event = { uid: 'doctor', summary: 'Doctor (moved)', startDate: '2026-10-21T07:00:00.000Z', endDate: '2026-10-21T08:00:00.000Z' }

  it('lists calendars by membership', async () => {
    expect((await call(calendarsIndex.GET, { user: 'alice', path: '/api/calendars' })).json.calendars[0]).toMatchObject({ role: 'owner', name: 'Clinic' })
    expect((await call(calendarsIndex.GET, { user: 'bob', path: '/api/calendars' })).json.calendars[0]).toMatchObject({ role: 'editor', ownerName: 'Alice' })
    expect((await call(calendarsIndex.GET, { user: 'dana', path: '/api/calendars' })).json.calendars).toEqual([])
    expect((await call(calendarsIndex.GET, { user: 'eve', path: '/api/calendars' })).json.calendars).toEqual([])
    expect((await call(calendarsIndex.GET, { path: '/api/calendars' })).status).toBe(401)
  })

  it('reads events: owner and calendar editor yes; event editor and stranger no', async () => {
    const path = `/api/calendars/${calendarId}/events`
    const params = { id: calendarId }
    expect((await call(eventsRoute.GET, { user: 'alice', path, params })).status).toBe(200)
    expect((await call(eventsRoute.GET, { user: 'bob', path, params })).status).toBe(200)
    expect((await call(eventsRoute.GET, { user: 'dana', path, params })).status).toBe(404)
    expect((await call(eventsRoute.GET, { user: 'eve', path, params })).status).toBe(404)
  })

  it('writes events: event editor only on their event', async () => {
    const path = `/api/calendars/${calendarId}/events`
    const params = { id: calendarId }
    expect((await call(eventsRoute.PUT, { user: 'alice', path, params, method: 'PUT', body: event })).status).toBe(200)
    expect((await call(eventsRoute.PUT, { user: 'bob', path, params, method: 'PUT', body: event })).status).toBe(200)
    expect((await call(eventsRoute.PUT, { user: 'dana', path, params, method: 'PUT', body: event })).status).toBe(200)
    expect((await call(eventsRoute.PUT, { user: 'dana', path, params, method: 'PUT', body: { ...event, uid: 'lunch' } })).status).toBe(404)
    expect((await call(eventsRoute.PUT, { user: 'eve', path, params, method: 'PUT', body: event })).status).toBe(404)
    expect((await call(eventsRoute.DELETE, { user: 'dana', path: `${path}?uid=lunch`, params, method: 'DELETE' })).status).toBe(404)
  })

  it('keeps SEQUENCE increasing on each server write', async () => {
    const path = `/api/calendars/${calendarId}/events`
    const first = await call(eventsRoute.PUT, { user: 'alice', path, params: { id: calendarId }, method: 'PUT', body: { ...event, sequence: 0 } })
    const second = await call(eventsRoute.PUT, { user: 'bob', path, params: { id: calendarId }, method: 'PUT', body: { ...event, sequence: 0 } })
    expect(second.json.event.sequence).toBeGreaterThan(first.json.event.sequence)
  })

  it('rejects non-JSON writes (CSRF) and oversized bodies', async () => {
    const url = new URL(`/api/calendars/${calendarId}/events`, ORIGIN)
    const form = new Request(url, { method: 'PUT', headers: { 'x-test-user': 'alice', 'content-type': 'application/x-www-form-urlencoded' }, body: 'uid=x' })
    expect((await eventsRoute.PUT!({ request: form, url, params: { id: calendarId } } as never)).status).toBe(415)
    const big = { ...event, description: 'x'.repeat(300_000) }
    expect((await call(eventsRoute.PUT, { user: 'alice', path: url.pathname, params: { id: calendarId }, method: 'PUT', body: big })).status).toBe(413)
  })

  it('manages the calendar and its links: owner only', async () => {
    const params = { id: calendarId }
    expect((await call(calendarRoute.PATCH, { user: 'bob', path: `/api/calendars/${calendarId}`, params, method: 'PATCH', body: { name: 'X' } })).status).toBe(403)
    expect((await call(calendarRoute.DELETE, { user: 'eve', path: `/api/calendars/${calendarId}`, params, method: 'DELETE' })).status).toBe(404)
    expect((await call(sharesIndex.POST, { user: 'bob', path: '/api/shares', method: 'POST', body: { calendarId, permission: 'full' } })).status).toBe(403)
    expect((await call(membersRoute.GET, { user: 'bob', path: `/api/calendars/${calendarId}/members`, params })).status).toBe(403)
    const members = await call(membersRoute.GET, { user: 'alice', path: `/api/calendars/${calendarId}/members`, params })
    expect(members.json.members.map((m: { userId: string; scope: string }) => `${m.userId}:${m.scope}`).sort()).toEqual(['bob:calendar', 'dana:event'])
  })

  it('shows a collaborator only their personal subscription link', async () => {
    await call(sharesIndex.POST, { user: 'alice', path: '/api/shares', method: 'POST', body: { calendarId, permission: 'busy' } })
    const asBob = await call(sharesIndex.GET, { user: 'bob', path: `/api/shares?calendarId=${calendarId}` })
    expect(asBob.json.shares).toHaveLength(1)
    expect(asBob.json.shares[0]).toMatchObject({ personal: true, permission: 'full' })
    const asAlice = await call(sharesIndex.GET, { user: 'alice', path: `/api/shares?calendarId=${calendarId}` })
    expect(asAlice.json.shares.map((s: { permission: string }) => s.permission).sort()).toEqual(['busy', 'edit', 'full'])
  })

  it('lists single shared events for the event editor', async () => {
    const res = await call(sharedRoute.GET, { user: 'dana', path: '/api/shared' })
    expect(res.json.shared).toHaveLength(1)
    expect(res.json.shared[0]).toMatchObject({ uid: 'doctor', role: 'editor', calendarName: 'Clinic' })
    expect(res.json.shared[0].events[0].summary).toBe('Doctor')
  })

  it('removing a member revokes their access and their personal feed', async () => {
    const personal = listShareLinks(db, calendarId, null, 'bob').find((l) => l.personal)!
    expect((await feed(personal.token)).status).toBe(200)
    const res = await call(membersRoute.DELETE, { user: 'alice', path: `/api/calendars/${calendarId}/members?userId=bob`, params: { id: calendarId }, method: 'DELETE' })
    expect(res.status).toBe(200)
    expect((await feed(personal.token)).status).toBe(404)
    expect((await call(eventsRoute.GET, { user: 'bob', path: `/api/calendars/${calendarId}/events`, params: { id: calendarId } })).status).toBe(404)
  })

  it('lets a member leave on their own', async () => {
    const res = await call(membersRoute.DELETE, { user: 'dana', path: `/api/calendars/${calendarId}/members?userId=dana&eventUid=doctor`, params: { id: calendarId }, method: 'DELETE' })
    expect(res.status).toBe(200)
    expect((await call(sharedRoute.GET, { user: 'dana', path: '/api/shared' })).json.shared).toEqual([])
  })
})

describe('feeds by permission', () => {
  const link = (permission: 'busy' | 'limited' | 'full' | 'edit', eventUid: string | null = null) =>
    createShareLink(db, { calendarId, eventUid, permission, createdBy: 'alice' }).token

  it('busy: only blocked time, no titles or details, no free events', async () => {
    const res = await feed(link('busy'))
    expect(res.status).toBe(200)
    expect(res.text).toContain('SUMMARY:Busy')
    expect(res.text).not.toMatch(/Doctor|Room 4|Clinic|alice@|Lunch/)
    expect(res.text.match(/BEGIN:VEVENT/g)).toHaveLength(1)
  })

  it('limited: titles and times only', async () => {
    const res = await feed(link('limited'))
    expect(res.text).toContain('SUMMARY:Doctor')
    expect(res.text).not.toMatch(/Room 4|Str\. Lunga|alice@/)
  })

  it('full: details, no alarms, feed metadata', async () => {
    const res = await feed(link('full'))
    expect(res.text).toContain('DESCRIPTION:Room 4')
    expect(res.text).toContain('LOCATION:Clinic\\, Str. Lunga 1')
    expect(res.text).not.toContain('BEGIN:VALARM')
    expect(res.text).toContain('METHOD:PUBLISH')
    expect(res.text).toContain('X-WR-CALNAME:Clinic')
    expect(res.text).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H')
    expect(res.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
  })

  it('single-event links carry only that event', async () => {
    const res = await feed(link('full', 'doctor'))
    expect(res.text.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(res.text).toContain('X-WR-CALNAME:Doctor')
  })

  it('editor invites are not feeds', async () => {
    expect((await feed(link('edit'))).status).toBe(404)
  })

  it('answers conditional requests with 304 and records access', async () => {
    const token = link('full')
    const first = await feed(token)
    const etag = first.headers.get('etag')!
    expect((await feed(token, { 'if-none-match': etag })).status).toBe(304)
    upsertEvent(db, calendarId, normalizeEvent({ uid: 'new', summary: 'New', startDate: '2026-11-01T07:00:00.000Z', endDate: '2026-11-01T08:00:00.000Z' }))
    const changed = await feed(token, { 'if-none-match': etag })
    expect(changed.status).toBe(200)
    expect(changed.text).toContain('SUMMARY:New')
    const row = listShareLinks(db, calendarId, null).find((l) => l.token === token)!
    expect(row.accessCount).toBe(3)
  })

  it('revoked, expired, rotated and unknown tokens all 404', async () => {
    const created = await call(sharesIndex.POST, { user: 'alice', path: '/api/shares', method: 'POST', body: { calendarId, permission: 'full' } })
    const id = created.json.share.id as string
    const token = created.json.share.links.https.split('/feed/')[1].replace('.ics', '')
    expect((await feed(token)).status).toBe(200)

    const rotated = await call(rotateRoute.POST, { user: 'alice', path: `/api/shares/${id}/rotate`, method: 'POST', params: { id }, body: {} })
    const newToken = rotated.json.share.links.https.split('/feed/')[1].replace('.ics', '')
    expect((await feed(token)).status).toBe(404)
    expect((await feed(newToken)).status).toBe(200)

    expect((await call(shareRoute.DELETE, { user: 'eve', path: `/api/shares/${id}`, params: { id }, method: 'DELETE' })).status).toBe(404)
    expect((await call(shareRoute.DELETE, { user: 'alice', path: `/api/shares/${id}`, params: { id }, method: 'DELETE' })).status).toBe(200)
    expect((await feed(newToken)).status).toBe(404)

    const expiring = createShareLink(db, { calendarId, eventUid: null, permission: 'full', createdBy: 'alice', expiresAt: Date.now() - 1 })
    expect((await feed(expiring.token)).status).toBe(404)
    expect((await feed('x'.repeat(43))).status).toBe(404)
  })

  it('HEAD returns headers without a body', async () => {
    const token = link('full')
    const res = await feedRoute.HEAD!({ request: new Request(`${ORIGIN}/feed/${token}.ics`, { method: 'HEAD' }), url: new URL(`${ORIGIN}/feed/${token}.ics`), params: { token } } as never)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })

  it('deleting the calendar removes its links', async () => {
    const token = link('full')
    await call(calendarRoute.DELETE, { user: 'alice', path: `/api/calendars/${calendarId}`, params: { id: calendarId }, method: 'DELETE' })
    expect((await feed(token)).status).toBe(404)
    expect(db.select().from(users).where(eq(users.id, 'alice')).get()).toBeDefined()
  })
})

describe('CSP for server-rendered pages', async () => {
  const { withHeaderDirectives } = await import('@/server/csp')
  it('adds frame-ancestors to the page policy without duplicating directives', () => {
    const merged = withHeaderDirectives("default-src 'self';object-src 'none'; script-src 'self' 'sha256-x';")
    expect(merged).toContain("frame-ancestors 'none'")
    expect(merged.match(/object-src/g)).toHaveLength(1)
    expect(merged).toContain("script-src 'self' 'sha256-x'")
  })
})

describe('pre-push review regressions', async () => {
  const { readJson } = await import('@/server/http')
  const { eventInput } = await import('@/server/schemas')
  const { sanitizeReturnTo } = await import('@/server/logto/client')
  const { getCalendar, MAX_EVENTS_PER_CALENDAR, updateShareLink } = await import('@/server/repo')
  const { events: eventsTable } = await import('@/server/db/schema')
  const path = () => `/api/calendars/${calendarId}/events`
  const base = { uid: 'x1', summary: 'X', startDate: '2026-10-21T07:00:00.000Z', endDate: '2026-10-21T08:00:00.000Z' }

  it('rejects enum fields carrying line breaks or unknown values', async () => {
    const put = (body: unknown) => call(eventsRoute.PUT, { user: 'alice', path: path(), params: { id: calendarId }, method: 'PUT', body })
    expect((await put({ ...base, status: 'TENTATIVE\r\nBEGIN:VEVENT' })).status).toBe(400)
    expect((await put({ ...base, recurrenceRule: { frequency: 'DAILY\r\nX:1', interval: 1 } })).status).toBe(400)
    expect((await put({ ...base, recurrenceRule: { frequency: 'WEEKLY', interval: 1, byDay: ['MO\nX'] } })).status).toBe(400)
    expect((await put({ ...base, status: 'TENTATIVE', recurrenceRule: { frequency: 'WEEKLY', interval: 1, byDay: ['MO', '-1FR'] } })).status).toBe(200)
  })

  it('stops reading a chunked body once it passes the cap', async () => {
    let pulled = 0
    const chunk = new Uint8Array(64 * 1024).fill(32)
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += chunk.byteLength
        if (pulled > 50 * 1024 * 1024) controller.close()
        else controller.enqueue(chunk)
      },
    })
    const request = new Request('https://calendar.test/api/x', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half' } as RequestInit)
    await expect(readJson(request, eventInput, 256 * 1024)).rejects.toMatchObject({ status: 413 })
    expect(pulled).toBeLessThan(2 * 1024 * 1024)
  })

  it('keeps returnTo on this site after URL normalisation', () => {
    expect(sanitizeReturnTo('/\t/evil.example/login')).toBe('/')
    expect(sanitizeReturnTo('/\n/evil.example')).toBe('/')
    expect(sanitizeReturnTo('/\\evil.example')).toBe('/')
    expect(sanitizeReturnTo('/s/abc?x=1#h')).toBe('/s/abc?x=1#h')
  })

  it('caps the number of events in a calendar', async () => {
    const now = Date.now()
    const filler = Array.from({ length: MAX_EVENTS_PER_CALENDAR - 3 }, (_, i) => ({
      id: `f${i}`, calendarId, uid: `f${i}`, recurrenceId: '', data: '{}', sequence: 0, startsAt: now, endsAt: now, createdAt: now, updatedAt: now,
    }))
    for (let i = 0; i < filler.length; i += 500) db.insert(eventsTable).values(filler.slice(i, i + 500)).run()
    const put = (uid: string) => call(eventsRoute.PUT, { user: 'alice', path: path(), params: { id: calendarId }, method: 'PUT', body: { ...base, uid } })
    expect((await put('last-ok')).status).toBe(200)
    const full = await put('one-too-many')
    expect(full.status).toBe(413)
    expect(full.json.error).toBe('calendar_full')
    expect((await put('doctor')).status).toBe(200) // updating an existing event still works
  })

  it('stores an empty timezone patch as UTC', async () => {
    await call(calendarRoute.PATCH, { user: 'alice', path: `/api/calendars/${calendarId}`, params: { id: calendarId }, method: 'PATCH', body: { timezone: '' } })
    expect(getCalendar(db, calendarId)!.timezone).toBe('UTC')
  })

  it('revalidates feeds by ETag only, and deletions change both ETag and Last-Modified', async () => {
    const token = createShareLink(db, { calendarId, eventUid: null, permission: 'full', createdBy: 'alice' }).token
    const first = await feed(token)
    const etag = first.headers.get('etag')!
    const lastModified = first.headers.get('last-modified')!
    expect((await feed(token, { 'if-modified-since': lastModified })).status).toBe(200)
    expect((await feed(token, { 'if-none-match': etag })).status).toBe(304)
    await new Promise((r) => setTimeout(r, 1100))
    await call(eventsRoute.DELETE, { user: 'alice', path: `${path()}?uid=lunch`, params: { id: calendarId }, method: 'DELETE' })
    const after = await feed(token, { 'if-none-match': etag })
    expect(after.status).toBe(200)
    expect(after.text).not.toContain('Lunch')
    expect(Date.parse(after.headers.get('last-modified')!)).toBeGreaterThan(Date.parse(lastModified))
  })

  it('serves a renamed link under its new name right away (render cache keyed on the change)', async () => {
    const link = createShareLink(db, { calendarId, eventUid: null, permission: 'limited', createdBy: 'alice' })
    expect((await feed(link.token)).text).toContain('X-WR-CALNAME:Clinic')
    updateShareLink(db, link.id, { label: 'Grandparents' })
    expect((await feed(link.token)).text).toContain('X-WR-CALNAME:Grandparents')
  })
})

describe('second review regressions', async () => {
  const importRoute = await import('../src/server-routes/api/calendars/import')
  const { readJson } = await import('@/server/http')
  const { eventInput } = await import('@/server/schemas')
  const { sanitizeReturnTo } = await import('@/server/logto/client')
  const { feedCacheStats, resolveShareMeta, sharePreviewCached } = await import('@/server/feed')
  const repo = await import('@/server/repo')
  const { calendars: calendarsTable, events: eventsTable } = await import('@/server/db/schema')
  const path = () => `/api/calendars/${calendarId}/events`
  const ev = (uid: string, extra: Record<string, unknown> = {}) => ({ uid, summary: uid, startDate: '2026-11-02T07:00:00.000Z', endDate: '2026-11-02T08:00:00.000Z', ...extra })
  const importBody = (events: unknown[]) => call(importRoute.POST, { user: 'alice', path: `/api/calendars/${calendarId}/import`, params: { id: calendarId }, method: 'POST', body: { events } })

  it('keeps one cached feed per link, however often the calendar changes', async () => {
    const before = feedCacheStats().slots
    const token = createShareLink(db, { calendarId, eventUid: null, permission: 'full', createdBy: 'alice' }).token
    for (let i = 0; i < 5; i++) {
      await call(eventsRoute.PUT, { user: 'alice', path: path(), params: { id: calendarId }, method: 'PUT', body: ev(`e${i}`) })
      expect((await feed(token)).text).toContain(`UID:e${i}`)
    }
    expect(feedCacheStats().slots - before).toBe(1)
  })

  it('maps the adapter\'s body-limit stream error to 413', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('Body size limit exceeded: received more than 9437184 bytes'))
      },
    })
    const request = new Request('https://calendar.test/api/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half' } as RequestInit)
    await expect(readJson(request, eventInput, 8 * 1024 * 1024)).rejects.toMatchObject({ status: 413 })
  })

  it('a calendar rename after an import never moves updated_at backwards', async () => {
    const res = await importBody(Array.from({ length: 300 }, (_, i) => ev(`imp${i}`)))
    expect(res.status).toBe(200)
    const after = repo.getCalendar(db, calendarId)!.updatedAt
    repo.updateCalendar(db, calendarId, { name: 'Renamed' })
    expect(repo.getCalendar(db, calendarId)!.updatedAt).toBeGreaterThan(after)
    // One touch per import, not one per row, so it is not 300 ms ahead of the clock.
    expect(after - Date.now()).toBeLessThan(50)
  })

  it('checks an import against the calendar bounds once and rolls it back when over', async () => {
    const now = Date.now()
    const filler = Array.from({ length: repo.MAX_EVENTS_PER_CALENDAR - 10 }, (_, i) => ({
      id: `g${i}`, calendarId, uid: `g${i}`, recurrenceId: '', data: '{}', size: 2, sequence: 0, startsAt: now, endsAt: now, createdAt: now, updatedAt: now,
    }))
    for (let i = 0; i < filler.length; i += 500) db.insert(eventsTable).values(filler.slice(i, i + 500)).run()
    const count = () => db.select().from(eventsTable).where(eq(eventsTable.calendarId, calendarId)).all().length
    const start = count()
    const res = await importBody(Array.from({ length: 50 }, (_, i) => ev(`over${i}`)))
    expect(res.status).toBe(413)
    expect(count()).toBe(start)
    expect((await importBody(Array.from({ length: 5 }, (_, i) => ev(`fits${i}`)))).status).toBe(200)
  })

  it('bounds the stored size of an event and of a calendar', async () => {
    const put = (body: unknown) => call(eventsRoute.PUT, { user: 'alice', path: path(), params: { id: calendarId }, method: 'PUT', body })
    const big = await put(ev('big', { comment: 'x'.repeat(200_000) }))
    expect(big.status).toBe(413)
    expect(big.json.error).toBe('event_too_large')
    const row = db.select().from(calendarsTable).where(eq(calendarsTable.id, calendarId)).get()!
    expect(row).toBeTruthy()
    // 300 events of ~60 KB pass the row cap but not the 16 MiB budget.
    let last = 200
    for (let i = 0; i < 300 && last === 200; i++) last = (await put(ev(`fat${i}`, { comment: 'y'.repeat(60_000) }))).status
    expect(last).toBe(413)
    const used = db.select().from(eventsTable).where(eq(eventsTable.calendarId, calendarId)).all().reduce((n, r) => n + r.size, 0)
    expect(used).toBeLessThanOrEqual(repo.MAX_CALENDAR_CHARS)
  })

  it('someone invited to one event cannot fill the calendar with overrides of it', async () => {
    const invite = createShareLink(db, { calendarId, eventUid: 'lunch', permission: 'edit', createdBy: 'alice' })
    await call(acceptRoute.POST, { user: 'dana', path: `/api/share/${invite.token}/accept`, params: { token: invite.token }, method: 'POST', body: {} })
    let status = 200
    let n = 0
    for (; n < repo.MAX_OVERRIDES_PER_EVENT + 5 && status === 200; n++) {
      const rid = new Date(Date.UTC(2027, 0, 1) + n * 86_400_000).toISOString()
      status = (await call(eventsRoute.PUT, { user: 'dana', path: path(), params: { id: calendarId }, method: 'PUT', body: ev('lunch', { recurrenceId: rid, startDate: rid, endDate: rid }) })).status
    }
    expect(status).toBe(413)
    expect(n).toBeLessThanOrEqual(repo.MAX_OVERRIDES_PER_EVENT + 1)
    expect((await call(eventsRoute.PUT, { user: 'alice', path: path(), params: { id: calendarId }, method: 'PUT', body: ev('owner-still-adds') })).status).toBe(200)
  })

  it('never returns a scheme-relative returnTo', () => {
    for (const raw of ['/.//evil.example', '/a/..//evil.example', '/%2E/\\evil.example', '/%2e%2E//evil.example/x']) {
      expect(sanitizeReturnTo(raw)).toBe('/')
    }
  })

  it('serves the share-page preview from cache until the link changes', () => {
    const link = createShareLink(db, { calendarId, eventUid: null, permission: 'limited', createdBy: 'alice' })
    const meta = () => resolveShareMeta(db, link.token)!
    const first = sharePreviewCached(db, meta())
    expect(first.events.length).toBeGreaterThan(0)
    // A row removed behind the repo's back does not change the version: the cache answers.
    db.delete(eventsTable).where(eq(eventsTable.calendarId, calendarId)).run()
    expect(sharePreviewCached(db, meta())).toBe(first)
    repo.touchCalendar(db, calendarId)
    expect(sharePreviewCached(db, meta()).events).toEqual([])
  })
})
