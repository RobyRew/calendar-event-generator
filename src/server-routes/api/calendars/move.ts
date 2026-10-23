import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, json, readJson } from '@/server/http'
import { moveInput } from '@/server/schemas'
import { moveEventsToCalendar } from '@/server/repo'
import { calendarFor } from '@/server/views'

// POST /api/calendars/[id]/move {uids, targetCalendarId} — move whole events (with
// their overrides) to another calendar. Editor on both calendars; neither may be a
// subscription.
export const POST: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const { uids, targetCalendarId } = await readJson(request, moveInput)
  const db = getDb()
  const { calendar: source } = calendarFor(db, user.id, params.id!, 'editor')
  const { calendar: target } = calendarFor(db, user.id, targetCalendarId, 'editor')
  return json({ events: moveEventsToCalendar(db, source.id, target.id, uids) })
})
