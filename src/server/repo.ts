import { randomBytes, randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm'
import type { CalendarEvent } from '@/types'
import { normalizeEvent } from '@/lib/normalize'
import { createDefaultEvent } from '@/lib/utils'
import { resolveZone } from '@/lib/time'
import type { DB } from './db/client'
import {
  calendars, events, memberships, shareLinks, users,
  type CalendarRow, type EventRow, type Permission, type ShareLinkRow,
} from './db/schema'
import { calendarRole, eventResourceId, type Role } from './authz'
import { HttpError } from './http'

// Feeds and share pages load and render a whole calendar per request, so its
// size is bounded: by rows, and by stored JSON (characters), since a row count
// alone let a calendar of 10,000 large events reach gigabytes. A single series
// (master plus overrides) has its own smaller bounds, so someone invited to one
// event cannot use up the owner's calendar by adding overrides of it.
export const MAX_EVENTS_PER_CALENDAR = 10_000
export const MAX_CALENDAR_CHARS = 16 * 1024 * 1024
export const MAX_EVENT_CHARS = 64 * 1024
export const MAX_OVERRIDES_PER_EVENT = 500
export const MAX_SERIES_CHARS = 2 * 1024 * 1024
// Per owner, so one account cannot grow without bound by adding calendars (an
// export of it is held in memory while it is sent).
export const MAX_CALENDARS_PER_USER = 50
export const MAX_USER_CHARS = 64 * 1024 * 1024

/**
 * Record a content change on a calendar. updated_at only ever moves forward, so
 * it can serve as the feed's Last-Modified and render-cache key: the newest
 * event row alone went backwards when that row was deleted.
 */
export function touchCalendar(db: DB, calendarId: string, now = Date.now()): void {
  db.update(calendars)
    .set({ updatedAt: sql`max(${calendars.updatedAt} + 1, ${now})` })
    .where(eq(calendars.id, calendarId))
    .run()
}

// ── Events ──────────────────────────────────────────────────────────────────

const EVENT_KEYS = new Set<string>([...Object.keys(createDefaultEvent()), 'recurrenceDates'])

/**
 * The stored shape of an event: normalised, known fields only, no calendarId
 * (that is the row's column). Client input never reaches the database unfiltered.
 */
export function toStoredEvent(input: Partial<CalendarEvent>): CalendarEvent {
  const e = normalizeEvent(input)
  return Object.fromEntries(Object.entries(e).filter(([k]) => EVENT_KEYS.has(k))) as unknown as CalendarEvent
}

export function rowToEvent(row: EventRow): CalendarEvent {
  return { ...(JSON.parse(row.data) as CalendarEvent), calendarId: row.calendarId }
}

export function listEvents(db: DB, calendarId: string): CalendarEvent[] {
  return db.select().from(events).where(eq(events.calendarId, calendarId)).orderBy(asc(events.startsAt)).all().map(rowToEvent)
}

export function listEventsByUid(db: DB, calendarId: string, uid: string): CalendarEvent[] {
  return db.select().from(events).where(and(eq(events.calendarId, calendarId), eq(events.uid, uid))).orderBy(asc(events.recurrenceId)).all().map(rowToEvent)
}

/** Rows and stored characters of a calendar (an index scan of events_calendar_size_idx). */
function calendarUsage(db: DB, calendarId: string): { rows: number; chars: number } {
  const r = db
    .select({ rows: sql<number>`count(*)`, chars: sql<number>`coalesce(sum(${events.size}), 0)` })
    .from(events)
    .where(eq(events.calendarId, calendarId))
    .get()
  return { rows: r?.rows ?? 0, chars: r?.chars ?? 0 }
}

/** Overrides and stored characters of one series (master plus overrides). */
function seriesUsage(db: DB, calendarId: string, uid: string): { overrides: number; chars: number } {
  const r = db
    .select({ overrides: sql<number>`coalesce(sum(${events.recurrenceId} <> ''), 0)`, chars: sql<number>`coalesce(sum(${events.size}), 0)` })
    .from(events)
    .where(and(eq(events.calendarId, calendarId), eq(events.uid, uid)))
    .get()
  return { overrides: r?.overrides ?? 0, chars: r?.chars ?? 0 }
}

/** Throw 413 unless adding `rows` rows and `chars` characters keeps the calendar and the series within bounds. */
/** Stored characters across every calendar of the calendar's owner. */
function ownerChars(db: DB, calendarId: string): number {
  const owner = db.select({ id: calendars.ownerId }).from(calendars).where(eq(calendars.id, calendarId)).get()?.id
  if (!owner) return 0
  return db
    .select({ chars: sql<number>`coalesce(sum(${events.size}), 0)` })
    .from(events)
    .innerJoin(calendars, eq(calendars.id, events.calendarId))
    .where(eq(calendars.ownerId, owner))
    .get()?.chars ?? 0
}

export function countOwnedCalendars(db: DB, ownerId: string): number {
  return db.select({ n: sql<number>`count(*)` }).from(calendars).where(eq(calendars.ownerId, ownerId)).get()?.n ?? 0
}

function checkRoom(db: DB, calendarId: string, uid: string, isOverride: boolean, rows: number, chars: number): void {
  if (rows <= 0 && chars <= 0) return // shrinking an event is always allowed
  const cal = calendarUsage(db, calendarId)
  if (cal.rows + rows > MAX_EVENTS_PER_CALENDAR || cal.chars + chars > MAX_CALENDAR_CHARS) throw new HttpError(413, 'calendar_full')
  if (chars > 0 && ownerChars(db, calendarId) + chars > MAX_USER_CHARS) throw new HttpError(413, 'account_full')
  const series = seriesUsage(db, calendarId, uid)
  if (isOverride && rows > 0 && series.overrides + rows > MAX_OVERRIDES_PER_EVENT) throw new HttpError(413, 'too_many_overrides')
  if (series.chars + chars > MAX_SERIES_CHARS) throw new HttpError(413, 'event_too_large')
}

/**
 * Throw 413 if the calendar, or any series in it, is over its bounds. Bulk
 * imports skip the per-row checks (a count per row made a 5,000-event import
 * take seconds) and call this once, inside their transaction, afterwards.
 */
export function assertCalendarWithinBounds(db: DB, calendarId: string): void {
  const cal = calendarUsage(db, calendarId)
  if (cal.rows > MAX_EVENTS_PER_CALENDAR || cal.chars > MAX_CALENDAR_CHARS) throw new HttpError(413, 'calendar_full')
  if (ownerChars(db, calendarId) > MAX_USER_CHARS) throw new HttpError(413, 'account_full')
  const over = db
    .select({ uid: events.uid })
    .from(events)
    .where(eq(events.calendarId, calendarId))
    .groupBy(events.uid)
    .having(sql`sum(${events.recurrenceId} <> '') > ${MAX_OVERRIDES_PER_EVENT} or sum(${events.size}) > ${MAX_SERIES_CHARS}`)
    .get()
  if (over) throw new HttpError(413, 'event_too_large')
}

/**
 * Insert or update by (calendar, UID, RECURRENCE-ID). SEQUENCE never goes
 * backwards. `checkCapacity: false` skips the size bounds; the caller must then
 * call assertCalendarWithinBounds before its transaction commits.
 */
export function upsertEvent(
  db: DB,
  calendarId: string,
  input: Partial<CalendarEvent>,
  now = Date.now(),
  opts: { checkCapacity?: boolean; touch?: boolean } = {},
): CalendarEvent {
  const checkCapacity = opts.checkCapacity !== false
  const stored = toStoredEvent(input)
  const existing = db
    .select({ id: events.id, sequence: events.sequence, size: events.size })
    .from(events)
    .where(and(eq(events.calendarId, calendarId), eq(events.uid, stored.uid), eq(events.recurrenceId, stored.recurrenceId)))
    .get()
  const iso = new Date(now).toISOString()
  if (existing) {
    const sequence = Math.max(stored.sequence, existing.sequence + 1)
    const next: CalendarEvent = { ...stored, sequence, lastModified: iso, dtstamp: iso }
    const data = JSON.stringify(next)
    if (data.length > MAX_EVENT_CHARS) throw new HttpError(413, 'event_too_large')
    if (checkCapacity) checkRoom(db, calendarId, next.uid, !!next.recurrenceId, 0, data.length - existing.size)
    db.update(events)
      .set({
        data,
        size: data.length,
        sequence,
        startsAt: Date.parse(next.startDate),
        endsAt: Date.parse(next.endDate),
        updatedAt: now,
      })
      .where(eq(events.id, existing.id))
      .run()
    if (opts.touch !== false) touchCalendar(db, calendarId, now)
    return { ...next, calendarId }
  }
  const next: CalendarEvent = { ...stored, created: stored.created || iso, lastModified: iso, dtstamp: iso }
  const data = JSON.stringify(next)
  if (data.length > MAX_EVENT_CHARS) throw new HttpError(413, 'event_too_large')
  if (checkCapacity) checkRoom(db, calendarId, next.uid, !!next.recurrenceId, 1, data.length)
  db.insert(events)
    .values({
      id: randomUUID(),
      calendarId,
      uid: next.uid,
      recurrenceId: next.recurrenceId,
      data,
      size: data.length,
      sequence: next.sequence,
      startsAt: Date.parse(next.startDate),
      endsAt: Date.parse(next.endDate),
      createdAt: now,
      updatedAt: now,
    })
    .run()
  if (opts.touch !== false) touchCalendar(db, calendarId, now)
  return { ...next, calendarId }
}

/**
 * Move whole events (master plus overrides, by UID) to another calendar, keeping
 * their UIDs and stored data. One transaction: it fails as a whole when the target
 * already holds one of the UIDs (409 uid_exists) or would go over its bounds (413).
 * Event-level invites and share links point at the event's old calendar, so they
 * are removed, as when the event is deleted.
 */
export function moveEventsToCalendar(db: DB, sourceId: string, targetId: string, uids: string[], now = Date.now()): CalendarEvent[] {
  if (sourceId === targetId) throw new HttpError(400, 'same_calendar')
  const unique = [...new Set(uids)]
  return db.transaction(() => {
    const clash = db
      .select({ uid: events.uid })
      .from(events)
      .where(and(eq(events.calendarId, targetId), inArray(events.uid, unique)))
      .get()
    if (clash) throw new HttpError(409, 'uid_exists', clash.uid)
    const moved = db
      .update(events)
      .set({ calendarId: targetId, updatedAt: now })
      .where(and(eq(events.calendarId, sourceId), inArray(events.uid, unique)))
      .run()
    if (moved.changes === 0) throw new HttpError(404, 'event_not_found')
    db.delete(memberships)
      .where(and(eq(memberships.resourceType, 'event'), inArray(memberships.resourceId, unique.map((u) => eventResourceId(sourceId, u)))))
      .run()
    db.delete(shareLinks).where(and(eq(shareLinks.calendarId, sourceId), inArray(shareLinks.eventUid, unique))).run()
    assertCalendarWithinBounds(db, targetId)
    touchCalendar(db, sourceId, now)
    touchCalendar(db, targetId, now)
    return db
      .select()
      .from(events)
      .where(and(eq(events.calendarId, targetId), inArray(events.uid, unique)))
      .orderBy(asc(events.uid), asc(events.recurrenceId))
      .all()
      .map(rowToEvent)
  })
}

/**
 * Delete one occurrence override, or (recurrenceId '') the event with all its
 * overrides. masterOnly deletes just the master row and keeps the overrides, and
 * the event's invites and links (undo uses it when a series keeps its overrides).
 */
export function deleteEvent(db: DB, calendarId: string, uid: string, recurrenceId = '', masterOnly = false): number {
  const where = recurrenceId || masterOnly
    ? and(eq(events.calendarId, calendarId), eq(events.uid, uid), eq(events.recurrenceId, recurrenceId))
    : and(eq(events.calendarId, calendarId), eq(events.uid, uid))
  const res = db.delete(events).where(where).run()
  if (res.changes) touchCalendar(db, calendarId)
  if (!recurrenceId && !masterOnly) {
    db.delete(memberships).where(and(eq(memberships.resourceType, 'event'), eq(memberships.resourceId, eventResourceId(calendarId, uid)))).run()
    db.delete(shareLinks).where(and(eq(shareLinks.calendarId, calendarId), eq(shareLinks.eventUid, uid))).run()
  }
  return res.changes
}

/** Latest change among a set of event rows (for Last-Modified). */
export function lastChange(db: DB, calendarId: string, uid: string | null): number {
  const where = uid ? and(eq(events.calendarId, calendarId), eq(events.uid, uid)) : eq(events.calendarId, calendarId)
  const row = db.select({ t: sql<number>`max(${events.updatedAt})` }).from(events).where(where).get()
  return row?.t ?? 0
}

// ── Calendars ───────────────────────────────────────────────────────────────

export interface CalendarView {
  id: string
  name: string
  description: string
  color: string
  timezone: string
  role: Role
  ownerName: string | null
  /** The .ics URL of a subscription calendar (read-only); null for a normal calendar. */
  sourceUrl: string | null
  fetchedAt: number | null
  fetchError: string | null
}

export function getCalendar(db: DB, id: string): CalendarRow | undefined {
  return db.select().from(calendars).where(eq(calendars.id, id)).get()
}

export function listCalendarsForUser(db: DB, userId: string): CalendarView[] {
  const memberOf = db
    .select({ id: memberships.resourceId })
    .from(memberships)
    .where(and(eq(memberships.resourceType, 'calendar'), eq(memberships.userId, userId)))
    .all()
    .map((m) => m.id)
  const rows = db
    .select({ cal: calendars, ownerName: users.name, ownerEmail: users.email })
    .from(calendars)
    .innerJoin(users, eq(users.id, calendars.ownerId))
    .where(memberOf.length ? or(eq(calendars.ownerId, userId), inArray(calendars.id, memberOf)) : eq(calendars.ownerId, userId))
    .orderBy(asc(calendars.createdAt))
    .all()
  return rows.map(({ cal, ownerName, ownerEmail }) => ({
    id: cal.id,
    name: cal.name,
    description: cal.description,
    color: cal.color,
    timezone: cal.timezone,
    role: calendarRole(db, userId, cal)!,
    ownerName: ownerName ?? ownerEmail,
    sourceUrl: cal.sourceUrl,
    fetchedAt: cal.fetchedAt,
    fetchError: cal.fetchError,
  }))
}

export function createCalendar(
  db: DB,
  ownerId: string,
  input: { name: string; description?: string; color?: string; timezone?: string; sourceUrl?: string | null },
): CalendarRow {
  const now = Date.now()
  const row: CalendarRow = {
    id: randomUUID(),
    ownerId,
    name: input.name,
    description: input.description ?? '',
    color: input.color ?? '#007aff',
    timezone: resolveZone(input.timezone),
    createdAt: now,
    updatedAt: now,
    sourceUrl: input.sourceUrl ?? null,
    sourceEtag: null,
    sourceLastModified: null,
    fetchedAt: null,
    fetchError: null,
  }
  db.insert(calendars).values(row).run()
  return row
}

export function updateCalendar(db: DB, id: string, patch: { name?: string; description?: string; color?: string; timezone?: string }): void {
  db.update(calendars)
    // Any timezone present goes through resolveZone; '' used to be stored as-is.
    // updated_at moves forward as in touchCalendar: a plain Date.now() could move
    // it back after an import had pushed it ahead of the clock, and a later write
    // could then land on a value the feed cache already held.
    .set({
      ...patch,
      ...(patch.timezone !== undefined
        ? {
            timezone: resolveZone(patch.timezone),
            // A subscription's floating times are read in its zone: forget the
            // ETag so the next refresh fetches and parses again (the background
            // job picks it up), instead of keeping times parsed in the old zone.
            sourceEtag: null,
            sourceLastModified: null,
            fetchedAt: null,
          }
        : {}),
      updatedAt: sql`max(${calendars.updatedAt} + 1, ${Date.now()})`,
    })
    .where(eq(calendars.id, id))
    .run()
}

export function deleteCalendar(db: DB, id: string): void {
  db.transaction((tx) => {
    // Memberships reference resources by id (calendar or calendar/uid), so no FK cascade.
    tx.delete(memberships).where(or(eq(memberships.resourceId, id), like(memberships.resourceId, `${id}/%`))).run()
    tx.delete(calendars).where(eq(calendars.id, id)).run() // events and share links cascade
  })
}

// ── Members ─────────────────────────────────────────────────────────────────

export interface MemberView {
  userId: string
  name: string | null
  email: string | null
  role: 'editor' | 'viewer'
  scope: 'calendar' | 'event'
  eventUid: string | null
}

export function addMembership(db: DB, calendarId: string, eventUid: string | null, userId: string, role: 'editor' | 'viewer'): void {
  db.insert(memberships)
    .values({
      resourceType: eventUid ? 'event' : 'calendar',
      resourceId: eventUid ? eventResourceId(calendarId, eventUid) : calendarId,
      userId,
      role,
      createdAt: Date.now(),
    })
    .onConflictDoUpdate({ target: [memberships.resourceType, memberships.resourceId, memberships.userId], set: { role } })
    .run()
}

export function listMembers(db: DB, calendarId: string): MemberView[] {
  return db
    .select({ m: memberships, name: users.name, email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(or(and(eq(memberships.resourceType, 'calendar'), eq(memberships.resourceId, calendarId)), and(eq(memberships.resourceType, 'event'), like(memberships.resourceId, `${calendarId}/%`))))
    .all()
    .map(({ m, name, email }) => ({
      userId: m.userId,
      name,
      email,
      role: m.role,
      scope: m.resourceType,
      eventUid: m.resourceType === 'event' ? m.resourceId.slice(calendarId.length + 1) : null,
    }))
}

/** Remove a member, and the personal subscription link their invite created. */
export function removeMembership(db: DB, calendarId: string, eventUid: string | null, userId: string): number {
  return db.transaction((tx) => {
    const res = tx
      .delete(memberships)
      .where(and(
        eq(memberships.resourceType, eventUid ? 'event' : 'calendar'),
        eq(memberships.resourceId, eventUid ? eventResourceId(calendarId, eventUid) : calendarId),
        eq(memberships.userId, userId),
      ))
      .run()
    tx.delete(shareLinks)
      .where(and(
        eq(shareLinks.calendarId, calendarId),
        eventUid ? eq(shareLinks.eventUid, eventUid) : isNull(shareLinks.eventUid),
        eq(shareLinks.createdBy, userId),
        eq(shareLinks.personal, true),
      ))
      .run()
    return res.changes
  })
}

/** Events shared with a user one at a time (event memberships), with the role on each. */
export function sharedEventsForUser(db: DB, userId: string): { calendar: CalendarRow; uid: string; role: 'editor' | 'viewer'; events: CalendarEvent[] }[] {
  const rows = db
    .select()
    .from(memberships)
    .where(and(eq(memberships.resourceType, 'event'), eq(memberships.userId, userId)))
    .all()
  const out: { calendar: CalendarRow; uid: string; role: 'editor' | 'viewer'; events: CalendarEvent[] }[] = []
  for (const m of rows) {
    const slash = m.resourceId.indexOf('/')
    const calendar = getCalendar(db, m.resourceId.slice(0, slash))
    if (!calendar) continue
    const uid = m.resourceId.slice(slash + 1)
    out.push({ calendar, uid, role: m.role, events: listEventsByUid(db, calendar.id, uid) })
  }
  return out
}

// ── Share links ─────────────────────────────────────────────────────────────

/** 32 random bytes, URL-safe: the bearer credential for a feed or an invite. */
export const newToken = () => randomBytes(32).toString('base64url')

export function createShareLink(
  db: DB,
  input: { calendarId: string; eventUid: string | null; permission: Permission; label?: string; createdBy: string; expiresAt?: number | null; personal?: boolean },
): ShareLinkRow {
  const row: ShareLinkRow = {
    id: randomUUID(),
    token: newToken(),
    calendarId: input.calendarId,
    eventUid: input.eventUid,
    permission: input.permission,
    label: input.label ?? '',
    createdBy: input.createdBy,
    personal: input.personal ?? false,
    createdAt: Date.now(),
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
    lastAccessedAt: null,
    accessCount: 0,
  }
  db.insert(shareLinks).values(row).run()
  return row
}

export function getShareLink(db: DB, id: string): ShareLinkRow | undefined {
  return db.select().from(shareLinks).where(eq(shareLinks.id, id)).get()
}

/** A usable link for this token: exists, not revoked, not expired. */
export function activeShareLinkByToken(db: DB, token: string, now = Date.now()): ShareLinkRow | undefined {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return undefined
  const link = db.select().from(shareLinks).where(eq(shareLinks.token, token)).get()
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt <= now)) return undefined
  return link
}

export function listShareLinks(db: DB, calendarId: string, eventUid: string | null, onlyCreatedBy?: string): ShareLinkRow[] {
  return db
    .select()
    .from(shareLinks)
    .where(and(
      eq(shareLinks.calendarId, calendarId),
      eventUid ? eq(shareLinks.eventUid, eventUid) : isNull(shareLinks.eventUid),
      isNull(shareLinks.revokedAt),
      ...(onlyCreatedBy ? [eq(shareLinks.createdBy, onlyCreatedBy)] : []),
    ))
    .orderBy(asc(shareLinks.createdAt))
    .all()
}

export function updateShareLink(db: DB, id: string, patch: { label?: string; expiresAt?: number | null }): void {
  db.update(shareLinks).set(patch).where(eq(shareLinks.id, id)).run()
  // The label is the feed's calendar name.
  const link = getShareLink(db, id)
  if (link) touchCalendar(db, link.calendarId)
}

export function revokeShareLink(db: DB, id: string): void {
  db.update(shareLinks).set({ revokedAt: Date.now() }).where(eq(shareLinks.id, id)).run()
}

/** New token for the same link; the old URL stops working immediately. */
export function rotateShareLink(db: DB, id: string): string {
  const token = newToken()
  db.update(shareLinks).set({ token }).where(eq(shareLinks.id, id)).run()
  const link = getShareLink(db, id)
  if (link) touchCalendar(db, link.calendarId)
  return token
}

export function recordAccess(db: DB, id: string, now = Date.now()): void {
  db.update(shareLinks).set({ lastAccessedAt: now, accessCount: sql`${shareLinks.accessCount} + 1` }).where(eq(shareLinks.id, id)).run()
}
