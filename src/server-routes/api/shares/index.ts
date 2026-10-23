import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { atLeast } from '@/server/authz'
import { handle, HttpError, json, readJson } from '@/server/http'
import { shareInput } from '@/server/schemas'
import { createShareLink, listEventsByUid, listShareLinks } from '@/server/repo'
import { calendarFor, eventFor, shareView } from '@/server/views'

// /api/shares?calendarId=…[&eventUid=…]
//   GET  — the owner sees every active link for the target; a collaborator sees
//          only the personal subscription link their invite gave them
//   POST — create a link (owner only)

export const GET: APIRoute = handle(async ({ request, url }) => {
  const user = await requireUser(request)
  const calendarId = url.searchParams.get('calendarId')
  if (!calendarId) throw new HttpError(400, 'calendar_required')
  const eventUid = url.searchParams.get('eventUid')
  const db = getDb()
  const { role } = eventUid ? eventFor(db, user.id, calendarId, eventUid, 'viewer') : calendarFor(db, user.id, calendarId, 'viewer')
  const links = listShareLinks(db, calendarId, eventUid, atLeast(role, 'owner') ? undefined : user.id)
  return json({ shares: links.map((l) => shareView(db, l)), role })
})

export const POST: APIRoute = handle(async ({ request }) => {
  const user = await requireUser(request)
  const body = await readJson(request, shareInput)
  const db = getDb()
  const { calendar } = calendarFor(db, user.id, body.calendarId, 'owner')
  const eventUid = body.eventUid ?? null
  if (eventUid && listEventsByUid(db, calendar.id, eventUid).length === 0) throw new HttpError(404, 'event_not_found')
  if (body.expiresAt && body.expiresAt <= Date.now()) throw new HttpError(400, 'expiry_in_past')
  // An editor invite to a subscription calendar would grant nothing: its events cannot be edited.
  if (body.permission === 'edit' && calendar.sourceUrl) throw new HttpError(409, 'read_only')
  const link = createShareLink(db, { calendarId: calendar.id, eventUid, permission: body.permission, label: body.label, createdBy: user.id, expiresAt: body.expiresAt ?? null })
  return json({ share: shareView(db, link) }, { status: 201 })
})
