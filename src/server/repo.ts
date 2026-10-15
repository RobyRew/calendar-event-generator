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

/** Insert or update by (calendar, UID, RECURRENCE-ID). SEQUENCE never goes backwards. */
export function upsertEvent(db: DB, calendarId: string, input: Partial<CalendarEvent>, now = Date.now()): CalendarEvent {
  const stored = toStoredEvent(input)
  const existing = db
    .select()
    .from(events)
    .where(and(eq(events.calendarId, calendarId), eq(events.uid, stored.uid), eq(events.recurrenceId, stored.recurrenceId)))
    .get()
  const iso = new Date(now).toISOString()
  if (existing) {
    const sequence = Math.max(stored.sequence, existing.sequence + 1)
    const next: CalendarEvent = { ...stored, sequence, lastModified: iso, dtstamp: iso }
    db.update(events)
      .set({
        data: JSON.stringify(next),
        sequence,
        startsAt: Date.parse(next.startDate),
        endsAt: Date.parse(next.endDate),
        updatedAt: now,
      })
      .where(eq(events.id, existing.id))
      .run()
    return { ...next, calendarId }
  }
  const next: CalendarEvent = { ...stored, created: stored.created || iso, lastModified: iso, dtstamp: iso }
  db.insert(events)
    .values({
      id: randomUUID(),
      calendarId,
      uid: next.uid,
      recurrenceId: next.recurrenceId,
      data: JSON.stringify(next),
      sequence: next.sequence,
      startsAt: Date.parse(next.startDate),
      endsAt: Date.parse(next.endDate),
      createdAt: now,
      updatedAt: now,
    })
    .run()
  return { ...next, calendarId }
}

/** Delete one occurrence override, or (recurrenceId '') the event with all its overrides. */
export function deleteEvent(db: DB, calendarId: string, uid: string, recurrenceId = ''): number {
  const where = recurrenceId
    ? and(eq(events.calendarId, calendarId), eq(events.uid, uid), eq(events.recurrenceId, recurrenceId))
    : and(eq(events.calendarId, calendarId), eq(events.uid, uid))
  const res = db.delete(events).where(where).run()
  if (!recurrenceId) {
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
  }))
}

export function createCalendar(db: DB, ownerId: string, input: { name: string; description?: string; color?: string; timezone?: string }): CalendarRow {
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
  }
  db.insert(calendars).values(row).run()
  return row
}

export function updateCalendar(db: DB, id: string, patch: { name?: string; description?: string; color?: string; timezone?: string }): void {
  db.update(calendars)
    .set({ ...patch, ...(patch.timezone ? { timezone: resolveZone(patch.timezone) } : {}), updatedAt: Date.now() })
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
}

export function revokeShareLink(db: DB, id: string): void {
  db.update(shareLinks).set({ revokedAt: Date.now() }).where(eq(shareLinks.id, id)).run()
}

/** New token for the same link; the old URL stops working immediately. */
export function rotateShareLink(db: DB, id: string): string {
  const token = newToken()
  db.update(shareLinks).set({ token }).where(eq(shareLinks.id, id)).run()
  return token
}

export function recordAccess(db: DB, id: string, now = Date.now()): void {
  db.update(shareLinks).set({ lastAccessedAt: now, accessCount: sql`${shareLinks.accessCount} + 1` }).where(eq(shareLinks.id, id)).run()
}
