import { describe, expect, it } from 'vitest'
import { bucketCount, clientIp, take } from '@/server/ratelimit'

describe('rate limiter', () => {
  it('keeps limiting fresh keys after many drained keys have filled the map', () => {
    // Each key hit twice: stored just below its burst, the shape the old
    // count-based sweep never removed, which then evicted every fresh bucket.
    for (let i = 0; i < 50_100; i++) {
      take(`feed:token:junk-${i}`, 60)
      take(`feed:token:junk-${i}`, 60)
    }
    let ok = 0
    for (let i = 0; i < 400; i++) if (take('api:fresh-client', 300).ok) ok++
    // ~300 (a token or two may refill during the loop); the old sweep let all 400 through.
    expect(ok).toBeGreaterThanOrEqual(300)
    expect(ok).toBeLessThan(310)
  })

  it('stays bounded when more keys are active within a minute than it can hold', () => {
    for (let i = 0; i < 120_000; i++) take(`feed:ip:flood-${i}`, 120)
    expect(bucketCount()).toBeLessThanOrEqual(50_000)
    // The most recently used bucket survives the eviction and still limits.
    let ok = 0
    for (let i = 0; i < 200; i++) if (take('api:steady', 100).ok) ok++
    for (let i = 0; i < 1000; i++) take(`feed:ip:flood2-${i}`, 120)
    for (let i = 0; i < 50; i++) if (take('api:steady', 100).ok) ok++
    expect(ok).toBeLessThan(110)
  })

  it('uses the right-most X-Forwarded-For entry (the one the proxy added)', () => {
    const r = new Request('https://x.test', { headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.9' } })
    expect(clientIp(r)).toBe('203.0.113.9')
  })
})
