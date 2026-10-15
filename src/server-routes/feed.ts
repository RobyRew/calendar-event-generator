import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { publicOrigin } from '@/server/env'
import { feedLevel, renderFeed, resolveShare, shareTitle } from '@/server/feed'
import { recordAccess } from '@/server/repo'
import { clientIp, take } from '@/server/ratelimit'

// GET/HEAD /feed/[token].ics — the live subscription feed.
//
// Calendar apps poll this from their own servers without cookies or headers, so
// the unguessable token in the URL is the credential. Unknown, revoked, expired
// and invite-only tokens all get the same 404, so a token's state cannot be probed.
// ETag/Last-Modified let clients that send conditional requests skip unchanged
// feeds; Google and Apple decide their own polling interval.

const notFound = () =>
  new Response('Not found\n', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  })

function serve(head: boolean): APIRoute {
  return ({ params, request, url }) => {
    const token = params.token ?? ''
    const ip = clientIp(request)
    const limited = [take(`feed:ip:${ip}`, 120), take(`feed:token:${token.slice(0, 64)}`, 60)].find((r) => !r.ok)
    if (limited) {
      return new Response('Too many requests\n', { status: 429, headers: { 'retry-after': String(limited.retryAfter), 'content-type': 'text/plain' } })
    }

    const db = getDb()
    const target = resolveShare(db, token)
    const level = target ? feedLevel(target.link) : null
    if (!target || !level) return notFound()

    const { body, etag, lastModified } = renderFeed(db, target, level, publicOrigin())
    recordAccess(db, target.link.id)

    const filename = shareTitle(target).replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 60) || 'calendar'
    const download = url.searchParams.has('download')
    const headers: Record<string, string> = {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'private, no-cache',
      etag,
      'last-modified': new Date(lastModified || Date.now()).toUTCString(),
      'content-disposition': `${download ? 'attachment' : 'inline'}; filename="${filename.replace(/"/g, '')}.ics"; filename*=UTF-8''${encodeURIComponent(filename)}.ics`,
      'x-robots-tag': 'noindex',
      'referrer-policy': 'no-referrer',
    }

    const inm = request.headers.get('if-none-match')
    const ims = request.headers.get('if-modified-since')
    const notModified = inm
      ? inm.split(',').map((t) => t.trim()).includes(etag)
      : ims && lastModified && Math.floor(lastModified / 1000) <= Math.floor(Date.parse(ims) / 1000)
    if (notModified) return new Response(null, { status: 304, headers: { etag, 'cache-control': headers['cache-control']! } })

    return new Response(head ? null : body, { status: 200, headers })
  }
}

export const GET = serve(false)
export const HEAD = serve(true)
