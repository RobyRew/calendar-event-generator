import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, HttpError } from '@/server/http'
import { exportAccountChunks } from '@/server/account'
import { take } from '@/server/ratelimit'

const headers = () => ({
  'content-type': 'application/json; charset=utf-8',
  'content-disposition': `attachment; filename="calgen-account-${new Date().toISOString().slice(0, 10)}.json"`,
  'cache-control': 'no-store',
})

/** The parts of Node's ServerResponse this route uses. */
interface NodeResponse {
  writableNeedDrain: boolean
  destroyed: boolean
  once(event: 'drain' | 'close', fn: () => void): void
  off(event: 'drain' | 'close', fn: () => void): void
}

/** The Node response of this request, set by server.mjs (absent in tests and `astro dev`). */
function nodeResponse(): NodeResponse | undefined {
  const store = (globalThis as Record<symbol, { getStore(): unknown } | undefined>)[Symbol.for('calgen.response')]
  return store?.getStore() as NodeResponse | undefined
}

function drained(res: NodeResponse): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      res.off('drain', done)
      res.off('close', done)
      resolve()
    }
    res.once('drain', done)
    res.once('close', done)
  })
}

// Users with an export being sent; released when its response closes.
const inFlight = new Set<string>()

// GET /api/account/export — everything stored for the signed-in user, as a JSON
// download streamed in small pieces. The next piece is only produced once the
// client has taken the previous ones, so an export nobody reads holds one piece
// in memory, not the whole account (the adapter writes without waiting, and the
// earlier version ran to the end into the socket buffer). One export at a time and
// two a minute per user.
export const GET: APIRoute = handle(async ({ request }) => {
  const user = await requireUser(request)
  // Astro answers HEAD with this handler's headers and drops the body unread.
  if (request.method === 'HEAD') return new Response(null, { headers: headers() })
  if (inFlight.has(user.id)) throw new HttpError(429, 'export_busy')
  if (!take(`export:${user.id}`, 2).ok) throw new HttpError(429, 'rate_limited')
  const res = nodeResponse()
  inFlight.add(user.id)
  let released = false
  const release = () => {
    if (released) return
    released = true
    inFlight.delete(user.id)
  }
  res?.once('close', release)
  const chunks = exportAccountChunks(getDb(), user.id)
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (res?.writableNeedDrain) await drained(res)
      if (res?.destroyed) {
        chunks.return(undefined)
        release()
        controller.close()
        return
      }
      const next = chunks.next()
      if (next.done) {
        if (!res) release() // without the Node response, the end of the body is the best signal
        controller.close()
      } else controller.enqueue(encoder.encode(next.value))
    },
    cancel() {
      chunks.return(undefined)
      release()
    },
  })
  return new Response(body, { headers: headers() })
})
