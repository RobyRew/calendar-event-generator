import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// Times are Unix milliseconds (Date.now()).

// ── Identity ────────────────────────────────────────────────────────────────
// Logto owns authentication. The app keeps a thin row keyed by the Logto subject
// (`sub`), the user's id across every RobyRew app; app data references users.id,
// never an email or a provider id.
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  logtoSub: text('logto_sub').notNull().unique(),
  email: text('email'), // cached from the ID token; may go stale
  name: text('name'),
  createdAt: integer('created_at').notNull(),
})

// Server-side OIDC token store (src/server/logto/sqlite-store.ts). The
// browser holds only the opaque session-id cookie.
export const logtoSessions = sqliteTable(
  'logto_sessions',
  {
    id: text('id').primaryKey(),
    data: text('data').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('logto_sessions_expires_idx').on(t.expiresAt)],
)

// ── Calendars and events ────────────────────────────────────────────────────
export const calendars = sqliteTable(
  'calendars',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    color: text('color').notNull().default('#007aff'),
    timezone: text('timezone').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('calendars_owner_idx').on(t.ownerId)],
)

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    calendarId: text('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
    uid: text('uid').notNull(),
    // '' for a master/single event; the RECURRENCE-ID instant for an override.
    // Part of the identity: an override shares its master's UID (RFC 5545).
    recurrenceId: text('recurrence_id').notNull().default(''),
    data: text('data').notNull(), // JSON CalendarEvent (normalised)
    // length(data), kept so per-calendar and per-series size budgets are an index scan.
    size: integer('size').notNull().default(0),
    sequence: integer('sequence').notNull().default(0),
    startsAt: integer('starts_at').notNull(),
    endsAt: integer('ends_at').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('events_identity_idx').on(t.calendarId, t.uid, t.recurrenceId),
    index('events_calendar_start_idx').on(t.calendarId, t.startsAt),
    index('events_calendar_size_idx').on(t.calendarId, t.size),
  ],
)

// ── Sharing ─────────────────────────────────────────────────────────────────
// A collaborator's access to a whole calendar or to one event (by its UID within
// a calendar, so a recurring event's overrides come with it). Created by accepting
// an editor invite link.
export const memberships = sqliteTable(
  'memberships',
  {
    resourceType: text('resource_type', { enum: ['calendar', 'event'] }).notNull(),
    // calendar id, or `${calendarId}/${uid}` for an event
    resourceId: text('resource_id').notNull(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['editor', 'viewer'] }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.resourceType, t.resourceId, t.userId] }),
    index('memberships_user_idx').on(t.userId),
  ],
)

// A share link. busy/limited/full are subscription feeds anyone holding the token
// can read (calendar apps fetch anonymously, so the token in the URL is the
// credential). edit is an invite: it needs a Logto sign-in and creates a membership.
// The token is stored as-is so its owner can copy the link again; it guards only
// data held in this same database.
export const shareLinks = sqliteTable(
  'share_links',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    calendarId: text('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
    // Set for a single-event link (the event's UID); null shares the whole calendar.
    eventUid: text('event_uid'),
    permission: text('permission', { enum: ['busy', 'limited', 'full', 'edit'] }).notNull(),
    label: text('label').notNull().default(''),
    createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    // A member's own subscription link: removed when the membership is.
    personal: integer('personal', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at'),
    revokedAt: integer('revoked_at'),
    lastAccessedAt: integer('last_accessed_at'),
    accessCount: integer('access_count').notNull().default(0),
  },
  (t) => [
    index('share_links_target_idx').on(t.calendarId, t.eventUid),
    check('share_links_permission_check', sql`${t.permission} in ('busy', 'limited', 'full', 'edit')`),
  ],
)

export type UserRow = typeof users.$inferSelect
export type CalendarRow = typeof calendars.$inferSelect
export type EventRow = typeof events.$inferSelect
export type ShareLinkRow = typeof shareLinks.$inferSelect
export type MembershipRow = typeof memberships.$inferSelect
export type Permission = ShareLinkRow['permission']
