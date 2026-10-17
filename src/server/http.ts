import { z } from 'zod'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = code,
  ) {
    super(message)
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers })
}

/**
 * Parse a JSON body with a size cap and a schema. Requiring the JSON content type
 * is part of CSRF protection: a cross-site HTML form cannot send it.
 */
export async function readJson<T>(request: Request, schema: z.ZodType<T>, maxBytes = 256 * 1024): Promise<T> {
  const type = request.headers.get('content-type') ?? ''
  if (!/^application\/json\b/i.test(type)) throw new HttpError(415, 'json_required')
  const length = Number(request.headers.get('content-length') ?? '0')
  if (length > maxBytes) throw new HttpError(413, 'too_large')
  // Count bytes as they arrive. A chunked request has no content-length, and
  // request.text() would buffer the whole stream before any size check.
  const chunks: Uint8Array[] = []
  let size = 0
  const reader = request.body?.getReader()
  if (reader) {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch (err) {
        // The adapter's own cap (bodySizeLimit) errors the stream with a plain
        // Error, which surfaced as a 500; it means the same as the check below.
        if (err instanceof Error && /body size limit/i.test(err.message)) throw new HttpError(413, 'too_large')
        throw err
      }
      const { done, value } = chunk
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new HttpError(413, 'too_large')
      }
      chunks.push(value)
    }
  }
  const body = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    body.set(c, offset)
    offset += c.byteLength
  }
  const text = new TextDecoder().decode(body)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new HttpError(400, 'invalid_json')
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new HttpError(400, 'invalid_body', z.prettifyError(parsed.error))
  return parsed.data
}

/** Wrap a route handler: HttpError → JSON error response; anything else → 500 (logged). */
export function handle<C>(fn: (ctx: C) => Promise<Response>): (ctx: C) => Promise<Response> {
  return async (ctx) => {
    try {
      return await fn(ctx)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.code, message: err.message }, { status: err.status })
      console.error('[api] unhandled error:', err)
      return json({ error: 'internal' }, { status: 500 })
    }
  }
}
