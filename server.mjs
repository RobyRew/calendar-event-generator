// Production entry (Dockerfile CMD). Wraps the @astrojs/node standalone handler so
// every response — prerendered pages and static assets included, which Astro's
// middleware never sees — gets the shared security headers. Script and style
// sources come from Astro's per-page <meta> CSP (security.csp); the header adds
// what a meta tag cannot carry. See scripts/security-headers.mjs.
//
// Boot order: autostart must be disabled before entry.mjs is imported, hence the
// dynamic import.
import http from 'node:http'
import { AsyncLocalStorage } from 'node:async_hooks'
import { securityHeaders } from './scripts/security-headers.mjs'

process.env.ASTRO_NODE_AUTOSTART = 'disabled'
const { handler } = await import('./dist/server/entry.mjs')

const PORT = Number(process.env.PORT) || 4321
const HOST = process.env.HOST || '0.0.0.0'
const standard = Object.entries(securityHeaders())
// Share pages and feeds carry their secret in the URL: never send it as a Referer.
const secretUrl = Object.entries(securityHeaders({ referrerPolicy: 'no-referrer' }))

// The Node response of the request being handled, for routes that stream a large
// body and must wait for the client to read it (src/server-routes/api/account/export.ts):
// the adapter writes each chunk without waiting, so without this an export a
// client never reads would sit in memory until the socket closed.
const responses = new AsyncLocalStorage()
globalThis[Symbol.for('calgen.response')] = responses

const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0]
  const headers = pathname.startsWith('/s/') || pathname.startsWith('/feed/') ? secretUrl : standard
  for (const [key, value] of headers) res.setHeader(key, value)
  responses.run(res, () => handler(req, res))
})
// A socket with no traffic for a minute is closed, so a client that stops
// reading cannot keep a response open indefinitely.
server.timeout = 60_000

server.listen(PORT, HOST, () => {
  console.log(`calendar-event-generator listening on http://${HOST}:${PORT}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
