import { defineMiddleware } from 'astro:middleware'
import { withHeaderDirectives } from '@/server/csp'
import { clientIp, take } from '@/server/ratelimit'

// Server build only (the static build has no API).
export const onRequest = defineMiddleware(async (context, next) => {
  if (import.meta.env.PUBLIC_CLOUD !== 'true' || context.isPrerendered) return next()

  // Rate-limit the JSON API per client IP; feeds and share pages limit themselves.
  if (context.url.pathname.startsWith('/api/') && context.url.pathname !== '/api/health') {
    const { ok, retryAfter } = take(`api:${clientIp(context.request)}`, 300)
    if (!ok) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': String(retryAfter) },
      })
    }
  }

  const response = await next()
  const csp = response.headers.get('content-security-policy')
  if (csp) response.headers.set('content-security-policy', withHeaderDirectives(csp))
  return response
})
