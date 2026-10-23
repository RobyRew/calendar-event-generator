import type { APIRoute } from 'astro'
import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { events as eventsTable } from '@/server/db/schema'
import { requireUser } from '@/server/auth'
import { handle, HttpError, json, readJson } from '@/server/http'
import { importInput } from '@/server/schemas'
import { assertCalendarWithinBounds, touchCalendar, upsertEvent } from '@/server/repo'
import { calendarFor } from '@/server/views'

// POST /api/calendars/[id]/import {events, createOnly?} — bulk upsert (ICS import,
// undo/redo). Moves send createOnly: an event the calendar already has is then
// refused with 409 uid_exists instead of being overwritten.
export const POST: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const { events, createOnly } = await readJson(request, importInput, 8 * 1024 * 1024)
  const db = getDb()
  const { calendar } = calendarFor(db, user.id, params.id!, 'editor')
  // Size bounds are checked once for the whole batch, and the calendar is touched
  // once; per row, the count alone made a 5,000-event import block for seconds.
  // A batch over the bounds throws inside the transaction, which rolls it back.
  const saved = db.transaction(() => {
    if (createOnly) {
      const uids = [...new Set(events.map((e) => e.uid))]
      const clash = db
        .select({ uid: eventsTable.uid })
        .from(eventsTable)
        .where(and(eq(eventsTable.calendarId, calendar.id), inArray(eventsTable.uid, uids)))
        .get()
      if (clash) throw new HttpError(409, 'uid_exists', clash.uid)
    }
    const now = Date.now()
    const out = events.map((e) => upsertEvent(db, calendar.id, e as never, now, { checkCapacity: false, touch: false }))
    assertCalendarWithinBounds(db, calendar.id)
    touchCalendar(db, calendar.id, now)
    return out
  })
  return json({ events: saved })
})
