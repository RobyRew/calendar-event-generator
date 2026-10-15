import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, json, readJson } from '@/server/http'
import { importInput } from '@/server/schemas'
import { upsertEvent } from '@/server/repo'
import { calendarFor } from '@/server/views'

// POST /api/calendars/[id]/import {events} — bulk upsert ("Move to account", ICS import).
export const POST: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const { events } = await readJson(request, importInput, 8 * 1024 * 1024)
  const db = getDb()
  const { calendar } = calendarFor(db, user.id, params.id!, 'editor')
  const saved = db.transaction(() => events.map((e) => upsertEvent(db, calendar.id, e as never)))
  return json({ events: saved })
})
