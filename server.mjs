// Production entry (Dockerfile CMD). Wraps the @astrojs/node standalone handler so
// every response — prerendered pages and static assets included, which Astro's
// middleware never sees — gets the shared security headers. Script and style
// sources come from Astro's per-page <meta> CSP (security.csp); the header adds
// what a meta tag cannot carry. See scripts/security-headers.mjs.
//
// Boot order: autostart must be disabled before entry.mjs is imported, hence the
// dynamic import.
import http from 'node:http'
import { securityHeaders } from './scripts/security-headers.mjs'

process.env.ASTRO_NODE_AUTOSTART = 'disabled'
const { handler } = await import('./dist/server/entry.mjs')

const PORT = Number(process.env.PORT) || 4321
const HOST = process.env.HOST || '0.0.0.0'
const standard = Object.entries(securityHeaders())
// Share pages and feeds carry their secret in the URL: never send it as a Referer.
const secretUrl = Object.entries(securityHeaders({ referrerPolicy: 'no-referrer' }))

const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0]
  const headers = pathname.startsWith('/s/') || pathname.startsWith('/feed/') ? secretUrl : standard
  for (const [key, value] of headers) res.setHeader(key, value)
  handler(req, res)
})

server.listen(PORT, HOST, () => {
  console.log(`calendar-event-generator listening on http://${HOST}:${PORT}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
