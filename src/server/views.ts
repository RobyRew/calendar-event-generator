import { subscribeLinks, type SubscribeLinks } from '@/lib/subscribe-links'
import type { DB } from './db/client'
import type { CalendarRow, ShareLinkRow } from './db/schema'
import { calendarRole, eventRole, requireRole, type Role } from './authz'
import { publicOrigin } from './env'
import { HttpError } from './http'
import { getCalendar } from './repo'
import { shareTitle, resolveShare } from './feed'

export interface ShareView {
  id: string
  permission: ShareLinkRow['permission']
  label: string
  eventUid: string | null
  personal: boolean
  createdAt: number
  expiresAt: number | null
  lastAccessedAt: number | null
  accessCount: number
  links: SubscribeLinks
}

export function shareView(db: DB, link: ShareLinkRow): ShareView {
  const target = resolveShare(db, link.token)
  const name = target ? shareTitle(target) : link.label
  return {
    id: link.id,
    permission: link.permission,
    label: link.label,
    eventUid: link.eventUid,
    personal: link.personal,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    lastAccessedAt: link.lastAccessedAt,
    accessCount: link.accessCount,
    links: subscribeLinks(publicOrigin(), link.token, name),
  }
}

/**
 * Editing events ('editor' level) is refused on a subscription calendar: its
 * events are replaced from the source URL on every refresh. Owner-level actions
 * (rename, colour, share links, delete) stay allowed.
 */
function refuseReadOnly(calendar: CalendarRow, needed: Role): void {
  if (needed === 'editor' && calendar.sourceUrl) throw new HttpError(409, 'read_only')
}

/** Load a calendar the user may act on at `needed` level (404 when no access at all). */
export function calendarFor(db: DB, userId: string, id: string, needed: Role): { calendar: CalendarRow; role: Role } {
  const calendar = getCalendar(db, id)
  if (!calendar) throw new HttpError(404, 'not_found')
  const role = calendarRole(db, userId, calendar)
  requireRole(role, needed)
  refuseReadOnly(calendar, needed)
  return { calendar, role }
}

/** Like calendarFor, but an event membership on `uid` also counts. */
export function eventFor(db: DB, userId: string, calendarId: string, uid: string, needed: Role): { calendar: CalendarRow; role: Role } {
  const calendar = getCalendar(db, calendarId)
  if (!calendar) throw new HttpError(404, 'not_found')
  const role = eventRole(db, userId, calendar, uid)
  requireRole(role, needed)
  refuseReadOnly(calendar, needed)
  return { calendar, role }
}
