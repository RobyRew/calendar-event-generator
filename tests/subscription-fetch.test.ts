import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import type { Socket } from 'node:net'

// fetchExternalCalendar against a real local server. The address guard is
// switched off for this file only (BlockList blocks nothing), so 127.0.0.1 can
// stand in for a public host; tests/features.test.ts covers the guard itself.
vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:net')>()
  class OpenBlockList {
    addSubnet() {}
    check() {
      return false
    }
  }
  return { ...actual, BlockList: OpenBlockList, default: { ...actual, BlockList: OpenBlockList } }
})

const { fetchExternalCalendar } = await import('@/server/subscriptions')

let server: http.Server
let base = ''
const open = new Set<Socket>()

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const drip = (status: number, headers: Record<string, string> = {}) => {
      res.writeHead(status, headers)
      const t = setInterval(() => res.write('x'.repeat(64 * 1024)), 5)
      res.on('close', () => clearInterval(t))
    }
    const hop = /^\/r(\d)$/.exec(req.url ?? '')
    if (hop) return drip(302, { location: `/r${Number(hop[1]) + 1}` })
    if (req.url === '/endless500') return drip(500)
    if (req.url === '/huge200') return drip(200, { 'content-type': 'text/calendar' })
    res.writeHead(404).end()
  })
  server.on('connection', (s) => {
    open.add(s)
    s.on('close', () => open.delete(s))
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})

afterAll(() => {
  for (const s of open) s.destroy()
  server.close()
})

const settle = () => new Promise((r) => setTimeout(r, 300))

describe('subscription fetch', () => {
  it('drops the body of an error response and closes the socket right away', async () => {
    await expect(fetchExternalCalendar(`${base}/endless500`, { etag: null, lastModified: null })).rejects.toThrow('http_500')
    await settle()
    expect(open.size).toBe(0)
  })

  it('closes every socket of a redirect chain, and gives up after three redirects', async () => {
    await expect(fetchExternalCalendar(`${base}/r0`, { etag: null, lastModified: null })).rejects.toThrow('too_many_redirects')
    await settle()
    expect(open.size).toBe(0)
  })

  it('reports a streamed body over the size cap as too large, not unreachable', async () => {
    await expect(fetchExternalCalendar(`${base}/huge200`, { etag: null, lastModified: null })).rejects.toThrow('too_large')
    await settle()
    expect(open.size).toBe(0)
  })
})
