// In-memory token buckets (one process; the app runs as a single container).

interface Bucket {
  tokens: number
  updated: number
}

const buckets = new Map<string, Bucket>()

/** Take one token from `key`'s bucket; refills `perMinute` tokens per minute up to `burst`. */
export function take(key: string, perMinute: number, burst = perMinute): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const b = buckets.get(key) ?? { tokens: burst, updated: now }
  b.tokens = Math.min(burst, b.tokens + ((now - b.updated) / 60_000) * perMinute)
  b.updated = now
  if (b.tokens < 1) {
    buckets.set(key, b)
    return { ok: false, retryAfter: Math.ceil(((1 - b.tokens) / perMinute) * 60) }
  }
  b.tokens -= 1
  buckets.set(key, b)
  if (buckets.size > 50_000) {
    // Drop full (idle) buckets so the map cannot grow without bound.
    for (const [k, v] of buckets) if (v.tokens >= burst - 1) buckets.delete(k)
  }
  return { ok: true, retryAfter: 0 }
}

export function clientIp(request: Request): string {
  // Traefik sets X-Forwarded-For; the left-most entry is the client.
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
