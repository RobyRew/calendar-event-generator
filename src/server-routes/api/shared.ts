import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, json } from '@/server/http'
import { sharedEventsForUser } from '@/server/repo'

// GET /api/shared — single events shared with the user through editor invites.
export const GET: APIRoute = handle(async ({ request }) => {
  const user = await requireUser(request)
  const shared = sharedEventsForUser(getDb(), user.id).map((s) => ({
    calendarId: s.calendar.id,
    calendarName: s.calendar.name,
    uid: s.uid,
    role: s.role,
    events: s.events,
  }))
  return json({ shared })
})
