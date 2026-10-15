import type { APIRoute } from 'astro'
import type { DB } from '@/server/db/client'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { calendarRole } from '@/server/authz'
import { handle, HttpError, json, readJson } from '@/server/http'
import { sharePatch } from '@/server/schemas'
import { getCalendar, getShareLink, revokeShareLink, updateShareLink } from '@/server/repo'
import { shareView } from '@/server/views'

// /api/shares/[id]  PATCH {label, expiresAt} · DELETE (revoke)
// Allowed for the calendar owner, or the link's creator (a collaborator's personal link).

export function manageable(db: DB, userId: string, id: string) {
  const link = getShareLink(db, id)
  if (!link || link.revokedAt) throw new HttpError(404, 'not_found')
  const calendar = getCalendar(db, link.calendarId)
  const isOwner = calendar && calendarRole(db, userId, calendar) === 'owner'
  if (!isOwner && link.createdBy !== userId) throw new HttpError(404, 'not_found')
  return link
}

export const PATCH: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const body = await readJson(request, sharePatch)
  const db = getDb()
  const link = manageable(db, user.id, params.id!)
  if (body.expiresAt && body.expiresAt <= Date.now()) throw new HttpError(400, 'expiry_in_past')
  updateShareLink(db, link.id, body)
  return json({ share: shareView(db, getShareLink(db, link.id)!) })
})

export const DELETE: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const db = getDb()
  revokeShareLink(db, manageable(db, user.id, params.id!).id)
  return json({ ok: true })
})
