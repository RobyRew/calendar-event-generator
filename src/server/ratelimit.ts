// In-memory token buckets (one process; the app runs as a single container).

interface Bucket {
  tokens: number
  updated: number
}

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 50_000
/** A sweep that has to evict brings the map down to this, so it runs once per 5,000 new keys at most. */
const LOW_WATER = 45_000
let lastSweep = 0

/** Take one token from `key`'s bucket; refills `perMinute` tokens per minute up to `burst`. */
export function take(key: string, perMinute: number, burst = perMinute): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const b = buckets.get(key) ?? { tokens: burst, updated: now }
  b.tokens = Math.min(burst, b.tokens + ((now - b.updated) / 60_000) * perMinute)
  b.updated = now
  // Delete before set so the Map's order is least recently touched first (see sweep).
  buckets.delete(key)
  buckets.set(key, b)
  if (b.tokens < 1) return { ok: false, retryAfter: Math.ceil(((1 - b.tokens) / perMinute) * 60) }
  b.tokens -= 1
  if (buckets.size > MAX_BUCKETS) sweep(now)
  return { ok: true, retryAfter: 0 }
}

/**
 * Make room in the bucket map. Buckets idle for a minute go first: every caller
 * uses burst <= perMinute, so such a bucket is full again and forgetting it
 * changes nothing. (Evicting by stored token count kept drained buckets forever
 * and, once the map was pinned above the limit, evicted every fresh bucket in its
 * own call, which disabled all limits.)
 *
 * The full scan runs at most once a second. When it finds nothing idle (more than
 * MAX_BUCKETS keys active within a minute), the least recently touched entries
 * are dropped down to LOW_WATER in one go; take() keeps the Map in that order.
 * (Dropping one per call was slow too: a Map keeps deleted slots until it is
 * rehashed, and each pass from the front skipped all of them.) Before this, the
 * idle scan ran on every call above the limit, which cost milliseconds per
 * request once the map held a few hundred thousand fresh keys.
 */
function sweep(now: number): void {
  if (now - lastSweep >= 1000) {
    lastSweep = now
    for (const [k, v] of buckets) if (now - v.updated >= 60_000) buckets.delete(k)
  }
  if (buckets.size <= MAX_BUCKETS) return
  for (const k of buckets.keys()) {
    if (buckets.size <= LOW_WATER) break
    buckets.delete(k)
  }
}

/** Buckets held (tests). */
export function bucketCount(): number {
  return buckets.size
}

/** Tests: forget every bucket. */
export function resetRateLimitsForTests(): void {
  buckets.clear()
}

export function clientIp(request: Request): string {
  // Traefik appends the address it received the connection from, so the
  // right-most X-Forwarded-For entry is the client; entries to its left are
  // whatever the client sent and cannot be trusted for rate limiting.
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]!
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}
