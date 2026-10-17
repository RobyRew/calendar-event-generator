import { createHash } from 'node:crypto'
import type { CalendarEvent } from '@/types'
import { generateICS } from '@/lib/ics-generator'
import { includeAtLevel, redactEvent, type RedactLevel } from '@/lib/redact'
import { feedUrl } from '@/lib/subscribe-links'
import type { DB } from './db/client'
import type { CalendarRow, ShareLinkRow } from './db/schema'
import { activeShareLinkByToken, getCalendar, lastChange, listEvents, listEventsByUid } from './repo'

// Live subscription feeds. A share link's permission maps onto a redaction level
// from src/lib/redact.ts, so a feed and a downloaded file at the same level carry
// exactly the same fields. Editor invites are not feeds.

export type FeedLevel = Extract<RedactLevel, 'busy' | 'limited' | 'full'>

export interface ShareTarget {
  link: ShareLinkRow
  calendar: CalendarRow
  events: CalendarEvent[]
}

export interface ShareMeta {
  link: ShareLinkRow
  calendar: CalendarRow
}

/** The active link and its calendar, without loading events; null for unknown, revoked or expired tokens. */
export function resolveShareMeta(db: DB, token: string): ShareMeta | null {
  const link = activeShareLinkByToken(db, token)
  if (!link) return null
  const calendar = getCalendar(db, link.calendarId)
  if (!calendar) return null
  return { link, calendar }
}

export function loadShareEvents(db: DB, meta: ShareMeta): CalendarEvent[] {
  return meta.link.eventUid ? listEventsByUid(db, meta.calendar.id, meta.link.eventUid) : listEvents(db, meta.calendar.id)
}

/** The active link and what it points at; null for unknown, revoked or expired tokens. */
export function resolveShare(db: DB, token: string): ShareTarget | null {
  const meta = resolveShareMeta(db, token)
  return meta ? { ...meta, events: loadShareEvents(db, meta) } : null
}

export function feedLevel(link: ShareLinkRow): FeedLevel | null {
  return link.permission === 'edit' ? null : link.permission
}

/** Name shown in the subscriber's calendar list; never reveals more than the level allows. */
export function shareTitle(target: ShareTarget, busyLabel = 'Busy'): string {
  if (target.link.label) return target.link.label
  if (target.link.permission === 'busy') return busyLabel
  if (target.link.eventUid) {
    const master = target.events.find((e) => !e.recurrenceId) ?? target.events[0]
    if (master?.summary) return master.summary
  }
  return target.calendar.name
}

export interface RenderedFeed {
  body: string
  etag: string
  lastModified: number
  title: string
}

// Rendered feeds, one slot per link and output variant (level, origin, busy
// label). A slot holds the newest version only: calendars.updated_at moves forward
// on every event, label and token change (touchCalendar, updateCalendar), so a
// version that includes it never serves stale content, and a new version replaces
// the old one. The UTC year is part of the version because the embedded VTIMEZONE
// covers a window that moves with it (see zoneSampleInstants).
//
// The cache is bounded by size as well as by slot count. It used to keep every
// version of every link up to 200 entries, and one 10,000-event feed renders to
// tens of MB, so a few dozen links (or edits between polls) could fill the heap.
const FEED_CACHE_SLOTS = 200
/** Budget for cached bodies, counted at two bytes per character. */
const FEED_CACHE_BYTES = 64 * 1024 * 1024
/** Bodies larger than this are rendered per request and not cached. */
const FEED_CACHE_MAX_BODY = 16 * 1024 * 1024
const feedCache = new Map<string, { version: string; feed: RenderedFeed; bytes: number }>()
let feedCacheBytes = 0

function linkVersion(meta: ShareMeta): string {
  return [meta.link.token, meta.link.label, meta.calendar.updatedAt, new Date().getUTCFullYear()].join('|')
}

function dropSlot(key: string): void {
  const old = feedCache.get(key)
  if (!old) return
  feedCache.delete(key)
  feedCacheBytes -= old.bytes
}

/** renderFeed through the cache; events are only loaded on a miss. */
export function renderFeedCached(db: DB, meta: ShareMeta, level: FeedLevel, origin: string, busyLabel = 'Busy'): RenderedFeed {
  const slot = [meta.link.id, level, origin, busyLabel].join('|')
  const version = linkVersion(meta)
  const hit = feedCache.get(slot)
  if (hit && hit.version === version) {
    feedCache.delete(slot)
    feedCache.set(slot, hit) // most recently used last
    return hit.feed
  }
  dropSlot(slot)
  const rendered = renderFeed(db, { ...meta, events: loadShareEvents(db, meta) }, level, origin, busyLabel)
  const bytes = rendered.body.length * 2
  if (bytes <= FEED_CACHE_MAX_BODY) {
    feedCache.set(slot, { version, feed: rendered, bytes })
    feedCacheBytes += bytes
    for (const k of feedCache.keys()) {
      if (feedCacheBytes <= FEED_CACHE_BYTES && feedCache.size <= FEED_CACHE_SLOTS) break
      dropSlot(k)
    }
  }
  return rendered
}

/** Bytes and slots the feed cache holds (tests). */
export function feedCacheStats(): { slots: number; bytes: number } {
  return { slots: feedCache.size, bytes: feedCacheBytes }
}

export interface SharePreview {
  title: string
  /** Upcoming events redacted to the link's level, at most 12; empty for invites. */
  events: CalendarEvent[]
}

// Share-page previews, one per link and label language, for an hour or until the
// link's version changes. The page is public, and each view loaded and parsed
// the whole calendar to show 12 events.
const PREVIEW_SLOTS = 500
const PREVIEW_TTL = 3_600_000
const previewCache = new Map<string, { version: string; at: number; preview: SharePreview }>()

export function sharePreviewCached(db: DB, meta: ShareMeta, busyLabel = 'Busy', now = Date.now()): SharePreview {
  const slot = [meta.link.id, busyLabel].join('|')
  const version = linkVersion(meta)
  const hit = previewCache.get(slot)
  if (hit && hit.version === version && now - hit.at < PREVIEW_TTL) return hit.preview
  const level = feedLevel(meta.link)
  // A calendar invite needs no events at all; a single-event share needs only that event's rows.
  const events = level || meta.link.eventUid ? loadShareEvents(db, meta) : []
  const preview: SharePreview = {
    title: shareTitle({ ...meta, events }, busyLabel),
    events: level
      ? events
          .filter((e) => includeAtLevel(e, level))
          .map((e) => redactEvent(e, level, { busyLabel }))
          .filter((e) => e.recurrenceRule || Date.parse(e.endDate) >= now)
          .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate))
          .slice(0, 12)
      : [],
  }
  previewCache.delete(slot)
  previewCache.set(slot, { version, at: now, preview })
  for (const k of previewCache.keys()) {
    if (previewCache.size <= PREVIEW_SLOTS) break
    previewCache.delete(k)
  }
  return preview
}

export function renderFeed(db: DB, target: ShareTarget, level: FeedLevel, origin: string, busyLabel = 'Busy'): RenderedFeed {
  const changed = Math.max(lastChange(db, target.calendar.id, target.link.eventUid), target.calendar.updatedAt)
  const title = shareTitle(target, busyLabel)
  const body = generateICS(target.events, {
    method: 'PUBLISH',
    redactLevel: level,
    busyLabel,
    // Subscribers set their own alerts; Apple otherwise adds the sharer's alarms.
    stripAlarms: true,
    includeAppleExtensions: level === 'full',
    includeGoogleExtensions: level === 'full',
    includeMicrosoftExtensions: level === 'full',
    calendarName: title,
    calendarDescription: level === 'full' && !target.link.eventUid ? target.calendar.description || undefined : undefined,
    calendarTimezone: target.calendar.timezone,
    calendarColor: target.calendar.color,
    refreshInterval: 'PT1H',
    sourceUrl: feedUrl(origin, target.link.token),
    // Fixed DTSTAMP fallback keeps the body (and its ETag) stable between edits.
    now: new Date(changed || 0).toISOString(),
  })
  const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 32)}"`
  return { body, etag, lastModified: changed, title }
}
