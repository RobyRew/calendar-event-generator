import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, HttpError, json, readJson } from '@/server/http'
import { eventInput } from '@/server/schemas'
import { deleteEvent, listEvents, upsertEvent } from '@/server/repo'
import { calendarFor, eventFor } from '@/server/views'

// /api/calendars/[id]/events
//   GET              — all events (calendar viewer+)
//   PUT    {event}   — create or update by UID + RECURRENCE-ID (editor on the calendar or the event)
//   DELETE ?uid=&recurrenceId= — one override, or the event with its overrides

export const GET: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const db = getDb()
  const { calendar } = calendarFor(db, user.id, params.id!, 'viewer')
  return json({ events: listEvents(db, calendar.id) })
})

export const PUT: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const body = await readJson(request, eventInput)
  const db = getDb()
  const { calendar } = eventFor(db, user.id, params.id!, body.uid, 'editor')
  return json({ event: upsertEvent(db, calendar.id, body as never) })
})

export const DELETE: APIRoute = handle(async ({ request, params, url }) => {
  const user = await requireUser(request)
  const uid = url.searchParams.get('uid')
  if (!uid) throw new HttpError(400, 'uid_required')
  const db = getDb()
  const { calendar } = eventFor(db, user.id, params.id!, uid, 'editor')
  deleteEvent(db, calendar.id, uid, url.searchParams.get('recurrenceId') ?? '')
  return json({ ok: true })
})
