import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, json, readJson } from '@/server/http'
import { importInput } from '@/server/schemas'
import { assertCalendarWithinBounds, touchCalendar, upsertEvent } from '@/server/repo'
import { calendarFor } from '@/server/views'

// POST /api/calendars/[id]/import {events} — bulk upsert ("Move to account", ICS import).
export const POST: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const { events } = await readJson(request, importInput, 8 * 1024 * 1024)
  const db = getDb()
  const { calendar } = calendarFor(db, user.id, params.id!, 'editor')
  // Size bounds are checked once for the whole batch, and the calendar is touched
  // once; per row, the count alone made a 5,000-event import block for seconds.
  // A batch over the bounds throws inside the transaction, which rolls it back.
  const saved = db.transaction(() => {
    const now = Date.now()
    const out = events.map((e) => upsertEvent(db, calendar.id, e as never, now, { checkCapacity: false, touch: false }))
    assertCalendarWithinBounds(db, calendar.id)
    touchCalendar(db, calendar.id, now)
    return out
  })
  return json({ events: saved })
})
