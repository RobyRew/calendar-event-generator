import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, json, readJson } from '@/server/http'
import { calendarPatch } from '@/server/schemas'
import { deleteCalendar, listCalendarsForUser, updateCalendar } from '@/server/repo'
import { calendarFor } from '@/server/views'

// /api/calendars/[id] — owner only.

export const PATCH: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const db = getDb()
  const { calendar } = calendarFor(db, user.id, params.id!, 'owner')
  updateCalendar(db, calendar.id, await readJson(request, calendarPatch))
  return json({ calendar: listCalendarsForUser(db, user.id).find((c) => c.id === calendar.id) })
})

export const DELETE: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const db = getDb()
  const { calendar } = calendarFor(db, user.id, params.id!, 'owner')
  deleteCalendar(db, calendar.id)
  return json({ ok: true })
})
