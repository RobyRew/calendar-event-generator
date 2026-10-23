import { and, asc, eq, gt, isNull, like, lt, ne, or } from 'drizzle-orm'
import type { DB } from './db/client'
import { calendars, events, logtoSessions, shareLinks, users, type ShareLinkRow } from './db/schema'
import { getPrefs } from './prefs'
import { idTokenSubject } from './logto/sqlite-store'
import { deleteCalendar, listCalendarsForUser, listMembers, sharedEventsForUser } from './repo'

// "Download my data" and "Delete my account". The sign-in identity itself lives in
// Logto (auth.robyrew.com, shared by every RobyRew app) and is not touched here.

const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null)

/** A share link without its token: the token is a credential, not data about the user. */
function linkView(l: ShareLinkRow) {
  return {
    calendarId: l.calendarId,
    eventUid: l.eventUid,
    permission: l.permission,
    label: l.label,
    personal: l.personal,
    createdAt: iso(l.createdAt),
    expiresAt: iso(l.expiresAt),
    revokedAt: iso(l.revokedAt),
    lastAccessedAt: iso(l.lastAccessedAt),
    accessCount: l.accessCount,
  }
}

/**
 * Everything this app stores about a user, as pieces of one JSON document: the
 * header first, then one owned calendar per piece. A large account is written out
 * calendar by calendar instead of being built (and pretty-printed) as one string,
 * which blocked the server for seconds and failed past V8's string length limit.
 */
export function* exportAccountChunks(db: DB, userId: string): Generator<string> {
  const user = db.select().from(users).where(eq(users.id, userId)).get()
  const visible = listCalendarsForUser(db, userId)
  const owned = visible.filter((c) => c.role === 'owner')
  const header = {
    format: 'calgen-account-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    user: user ? { id: user.id, email: user.email, name: user.name, createdAt: iso(user.createdAt) } : null,
    preferences: Object.fromEntries(Object.entries(getPrefs(db, userId)).map(([k, v]) => [k, v?.value ?? null])),
    calendarsSharedWithMe: visible.filter((c) => c.role !== 'owner').map((c) => ({ id: c.id, name: c.name, role: c.role, owner: c.ownerName })),
    eventsSharedWithMe: sharedEventsForUser(db, userId).map((s) => ({ calendarId: s.calendar.id, calendar: s.calendar.name, uid: s.uid, role: s.role })),
    // Links this user made on other people's calendars (personal subscription links among them).
    myLinksElsewhere: db
      .select({ link: shareLinks })
      .from(shareLinks)
      .innerJoin(calendars, eq(calendars.id, shareLinks.calendarId))
      .where(and(eq(shareLinks.createdBy, userId), ne(calendars.ownerId, userId)))
      .all()
      .map((r) => linkView(r.link)),
  }
  const head = JSON.stringify(header)
  yield `${head.slice(0, -1)},"calendars":[`
  let first = true
  for (const c of owned) {
    const meta = JSON.stringify({
      id: c.id,
      name: c.name,
      description: c.description,
      color: c.color,
      timezone: c.timezone,
      subscriptionUrl: c.sourceUrl,
      // Every link on the calendar, revoked ones and members' personal ones included.
      shareLinks: db.select().from(shareLinks).where(eq(shareLinks.calendarId, c.id)).all().map(linkView),
      members: listMembers(db, c.id).map((m) => ({ name: m.name, email: m.email, role: m.role, eventUid: m.eventUid })),
    })
    yield `${first ? '' : ','}${meta.slice(0, -1)},"events":[`
    first = false
    // Events a page at a time (keyset paging, stable while the calendar changes),
    // so a large calendar is never loaded or held whole. Stored data is already
    // JSON of the event without its calendarId.
    let after: { startsAt: number; id: string } | null = null
    let sep = ''
    for (;;) {
      const page: { id: string; startsAt: number; data: string }[] = db
        .select({ id: events.id, startsAt: events.startsAt, data: events.data })
        .from(events)
        .where(and(
          eq(events.calendarId, c.id),
          after ? or(gt(events.startsAt, after.startsAt), and(eq(events.startsAt, after.startsAt), gt(events.id, after.id))) : undefined,
        ))
        .orderBy(asc(events.startsAt), asc(events.id))
        .limit(EXPORT_PAGE)
        .all()
      if (page.length === 0) break
      yield sep + page.map((row) => row.data).join(',')
      sep = ','
      const last = page[page.length - 1]!
      after = { startsAt: last.startsAt, id: last.id }
      if (page.length < EXPORT_PAGE) break
    }
    yield ']}'
  }
  yield ']}'
}

/** Events per piece of the export stream. */
const EXPORT_PAGE = 200

/**
 * Delete a user and everything they own: their calendars (with events, links and
 * other people's memberships in them), their memberships and links elsewhere,
 * their preferences and every sign-in session of theirs on this app.
 */
export function deleteAccount(db: DB, userId: string, now = Date.now()): void {
  const user = db.select().from(users).where(eq(users.id, userId)).get()
  if (!user) return
  db.transaction(() => {
    for (const c of db.select({ id: calendars.id }).from(calendars).where(eq(calendars.ownerId, userId)).all()) deleteCalendar(db, c.id)
    // Cascades: memberships, share links created by the user, preferences.
    db.delete(users).where(eq(users.id, userId)).run()
    // A remaining session would sign the user straight back in and recreate an
    // empty account. Sessions record their subject (indexed); only rows saved
    // before that column existed (subject NULL) are read, and only signed-in ones.
    db.delete(logtoSessions).where(eq(logtoSessions.subject, user.logtoSub)).run()
    db.delete(logtoSessions).where(lt(logtoSessions.expiresAt, now)).run()
    const legacy = db
      .select({ id: logtoSessions.id, data: logtoSessions.data })
      .from(logtoSessions)
      .where(and(isNull(logtoSessions.subject), like(logtoSessions.data, '%"idToken"%')))
      .all()
    for (const s of legacy) {
      let token: string | undefined
      try {
        token = (JSON.parse(s.data) as Record<string, string>).idToken
      } catch { /* not JSON: not a session of this user */ }
      if (idTokenSubject(token) === user.logtoSub) db.delete(logtoSessions).where(eq(logtoSessions.id, s.id)).run()
    }
  })
}
