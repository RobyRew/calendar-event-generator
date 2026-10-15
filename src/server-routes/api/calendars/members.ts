import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, HttpError, json } from '@/server/http'
import { getCalendar, listMembers, removeMembership } from '@/server/repo'
import { calendarFor } from '@/server/views'

// /api/calendars/[id]/members
//   GET                          — collaborators (owner)
//   DELETE ?userId=[&eventUid=]  — remove a collaborator (owner), or leave (the member)

export const GET: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const db = getDb()
  const { calendar } = calendarFor(db, user.id, params.id!, 'owner')
  return json({ members: listMembers(db, calendar.id) })
})

export const DELETE: APIRoute = handle(async ({ request, params, url }) => {
  const user = await requireUser(request)
  const userId = url.searchParams.get('userId')
  if (!userId) throw new HttpError(400, 'user_required')
  const db = getDb()
  const calendar = getCalendar(db, params.id!)
  if (!calendar) throw new HttpError(404, 'not_found')
  if (userId !== user.id) calendarFor(db, user.id, calendar.id, 'owner')
  const removed = removeMembership(db, calendar.id, url.searchParams.get('eventUid'), userId)
  if (!removed) throw new HttpError(404, 'not_found')
  return json({ ok: true })
})
