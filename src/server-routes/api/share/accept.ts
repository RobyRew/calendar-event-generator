import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { calendarRole } from '@/server/authz'
import { handle, HttpError, json } from '@/server/http'
import { activeShareLinkByToken, addMembership, createShareLink, getCalendar, listShareLinks } from '@/server/repo'

// POST /api/share/[token]/accept — the signed-in user joins through an editor invite.
// They become an editor of the calendar (or the one event) and get a personal
// full-detail subscription link, removed again if they leave or are removed.
export const POST: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const db = getDb()
  const link = activeShareLinkByToken(db, params.token!)
  if (!link || link.permission !== 'edit') throw new HttpError(404, 'not_found')
  const calendar = getCalendar(db, link.calendarId)
  if (!calendar) throw new HttpError(404, 'not_found')
  if (calendarRole(db, user.id, calendar) !== 'owner') {
    db.transaction(() => {
      addMembership(db, calendar.id, link.eventUid, user.id, 'editor')
      const hasPersonal = listShareLinks(db, calendar.id, link.eventUid, user.id).some((l) => l.personal)
      if (!hasPersonal) {
        createShareLink(db, { calendarId: calendar.id, eventUid: link.eventUid, permission: 'full', createdBy: user.id, personal: true })
      }
    })
  }
  return json({ calendarId: calendar.id, eventUid: link.eventUid })
})
