import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import net from 'node:net'
import { AsyncLocalStorage } from 'node:async_hooks'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { writeResponse } from 'astro/app/node'
import { openDatabase, setDatabaseForTests, type DB } from '@/server/db/client'
import { events as eventsTable, users } from '@/server/db/schema'
import { HttpError } from '@/server/http'
import { createCalendar } from '@/server/repo'
import { resetRateLimitsForTests } from '@/server/ratelimit'

// The account export behind a real HTTP server, written with the adapter's own
// writeResponse and the request's Node response in AsyncLocalStorage, as
// server.mjs does: a client that does not read must not make the server build
// the whole export in memory.

vi.mock('@/server/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/auth')>()
  return {
    ...actual,
    requireUser: async (request: Request) => {
      const id = request.headers.get('x-test-user')
      if (!id) throw new HttpError(401, 'unauthenticated')
      return { id, email: null, name: null }
    },
  }
})

const exportRoute = await import('../src/server-routes/api/account/export')

let db: DB
let server: http.Server
let port = 0
const responses = new AsyncLocalStorage<http.ServerResponse>()
;(globalThis as Record<symbol, unknown>)[Symbol.for('calgen.response')] = responses
const live = new Set<http.ServerResponse>()

beforeAll(async () => {
  server = http.createServer((req, res) => {
    live.add(res)
    res.on('close', () => live.delete(res))
    responses.run(res, async () => {
      const request = new Request(`http://localhost${req.url}`, { headers: { 'x-test-user': String(req.headers['x-test-user'] ?? '') } })
      const response = await exportRoute.GET({ request, url: new URL(request.url), params: {} } as never)
      await writeResponse(response, res)
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  port = (server.address() as { port: number }).port
})

afterAll(() => server.close())

beforeEach(() => {
  const handle = openDatabase(':memory:')
  migrate(handle.db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  setDatabaseForTests(handle)
  db = handle.db
  resetRateLimitsForTests()
  db.insert(users).values({ id: 'big', logtoSub: 'sub-big', email: null, name: 'Big', createdAt: Date.now() }).run()
  const cal = createCalendar(db, 'big', { name: 'Big', timezone: 'UTC' }).id
  const now = Date.now()
  const rows = Array.from({ length: 2000 }, (_, i) => {
    const data = JSON.stringify({ uid: `e${i}`, summary: 'x', description: 'y'.repeat(10_000), startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-01T01:00:00.000Z' })
    return { id: randomUUID(), calendarId: cal, uid: `e${i}`, recurrenceId: '', data, size: data.length, sequence: 0, startsAt: now + i, endsAt: now + i, createdAt: now, updatedAt: now }
  })
  for (let i = 0; i < rows.length; i += 200) db.insert(eventsTable).values(rows.slice(i, i + 200)).run()
})

/** Open a request and never read the response. */
function stalled(user: string): Promise<net.Socket> {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1', () => {
      s.write(`GET /api/account/export HTTP/1.1\r\nHost: localhost\r\nx-test-user: ${user}\r\n\r\n`)
      s.pause()
      setTimeout(() => resolve(s), 500)
    })
  })
}

describe('account export stream', () => {
  it('a client that does not read does not make the server buffer the whole export (~20 MB)', async () => {
    const s = await stalled('big')
    const buffered = [...live].reduce((n, r) => n + r.writableLength, 0)
    expect(buffered).toBeLessThan(4 * 1024 * 1024)
    s.destroy()
  })

  it('one export at a time per user, released when the client goes away', async () => {
    const s = await stalled('big')
    const second = await fetch(`http://127.0.0.1:${port}/api/account/export`, { headers: { 'x-test-user': 'big' } })
    expect(second.status).toBe(429)
    expect((await second.json()).error).toBe('export_busy')
    s.destroy()
    await new Promise((r) => setTimeout(r, 200))
    const third = await fetch(`http://127.0.0.1:${port}/api/account/export`, { headers: { 'x-test-user': 'big' } })
    expect(third.status).toBe(200)
    const body = await third.json()
    expect(body.calendars[0].events).toHaveLength(2000)
  })
})
