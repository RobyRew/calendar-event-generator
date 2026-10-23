import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, json, readJson } from '@/server/http'
import { deleteEvent } from '@/server/repo'
import { calendarFor } from '@/server/views'

const input = z.object({ uids: z.array(z.string().min(1).max(255)).min(1).max(1000), masterOnly: z.boolean().optional() })

// POST /api/calendars/[id]/delete-events {uids, masterOnly?} — delete whole events
// (with their overrides; masterOnly: only the master rows) in one request; editor
// on the calendar. Undo of a large move used to
// send one DELETE per event and ran into the API rate limit half-way.
export const POST: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const { uids, masterOnly } = await readJson(request, input)
  const db = getDb()
  const { calendar } = calendarFor(db, user.id, params.id!, 'editor')
  const deleted = db.transaction(() => uids.reduce((n, uid) => n + deleteEvent(db, calendar.id, uid, '', masterOnly ?? false), 0))
  return json({ deleted })
})
