import { and, eq } from 'drizzle-orm'
import type { DB } from './db/client'
import { memberships, type CalendarRow } from './db/schema'
import { HttpError } from './http'

// Who may do what. Decided here, server-side, from the session user — never from
// anything the client sends.
//   owner  — created the calendar: everything, including share links and members
//   editor — accepted an editor invite: create, edit and delete events
//   viewer — read events
// A calendar membership covers every event in it; an event membership covers one
// event (its UID, so a recurring event's overrides too).

export type Role = 'owner' | 'editor' | 'viewer'

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 }

export function atLeast(role: Role | null, needed: Role): boolean {
  return !!role && RANK[role] >= RANK[needed]
}

const better = (a: Role | null, b: Role | null): Role | null => (!a ? b : !b ? a : RANK[a] >= RANK[b] ? a : b)

export const eventResourceId = (calendarId: string, uid: string) => `${calendarId}/${uid}`

export function calendarRole(db: DB, userId: string, calendar: CalendarRow): Role | null {
  if (calendar.ownerId === userId) return 'owner'
  const m = db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.resourceType, 'calendar'), eq(memberships.resourceId, calendar.id), eq(memberships.userId, userId)))
    .get()
  return m?.role ?? null
}

export function eventRole(db: DB, userId: string, calendar: CalendarRow, uid: string): Role | null {
  const viaCalendar = calendarRole(db, userId, calendar)
  if (viaCalendar === 'owner') return viaCalendar
  const m = db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.resourceType, 'event'), eq(memberships.resourceId, eventResourceId(calendar.id, uid)), eq(memberships.userId, userId)))
    .get()
  return better(viaCalendar, m?.role ?? null)
}

/** Throws 404 (not 403) when the user has no access at all, so ids cannot be probed. */
export function requireRole(role: Role | null, needed: Role): asserts role is Role {
  if (!role) throw new HttpError(404, 'not_found')
  if (!atLeast(role, needed)) throw new HttpError(403, 'forbidden')
}
