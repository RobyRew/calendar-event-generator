import { createHash } from 'node:crypto'
import type { CalendarEvent } from '@/types'
import { generateICS } from '@/lib/ics-generator'
import type { RedactLevel } from '@/lib/redact'
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

/** The active link and what it points at; null for unknown, revoked or expired tokens. */
export function resolveShare(db: DB, token: string): ShareTarget | null {
  const link = activeShareLinkByToken(db, token)
  if (!link) return null
  const calendar = getCalendar(db, link.calendarId)
  if (!calendar) return null
  const events = link.eventUid ? listEventsByUid(db, calendar.id, link.eventUid) : listEvents(db, calendar.id)
  return { link, calendar, events }
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
}

export function renderFeed(db: DB, target: ShareTarget, level: FeedLevel, origin: string, busyLabel = 'Busy'): RenderedFeed {
  const changed = Math.max(lastChange(db, target.calendar.id, target.link.eventUid), target.calendar.updatedAt)
  const body = generateICS(target.events, {
    method: 'PUBLISH',
    redactLevel: level,
    busyLabel,
    // Subscribers set their own alerts; Apple otherwise adds the sharer's alarms.
    stripAlarms: true,
    includeAppleExtensions: level === 'full',
    includeGoogleExtensions: level === 'full',
    includeMicrosoftExtensions: level === 'full',
    calendarName: shareTitle(target, busyLabel),
    calendarDescription: level === 'full' && !target.link.eventUid ? target.calendar.description || undefined : undefined,
    calendarTimezone: target.calendar.timezone,
    calendarColor: target.calendar.color,
    refreshInterval: 'PT1H',
    sourceUrl: feedUrl(origin, target.link.token),
    // Fixed DTSTAMP fallback keeps the body (and its ETag) stable between edits.
    now: new Date(changed || 0).toISOString(),
  })
  const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 32)}"`
  return { body, etag, lastModified: changed }
}
