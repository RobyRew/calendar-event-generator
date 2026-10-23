import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, HttpError, json } from '@/server/http'
import { getCalendar, listCalendarsForUser } from '@/server/repo'
import { MANUAL_REFRESH_MIN_MS, refreshSubscription } from '@/server/subscriptions'
import { calendarFor } from '@/server/views'
import { take } from '@/server/ratelimit'

// POST /api/calendars/[id]/refresh — fetch a subscription calendar now (owner only;
// at most once a minute).
export const POST: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const db = getDb()
  const { calendar } = calendarFor(db, user.id, params.id!, 'owner')
  if (!calendar.sourceUrl) throw new HttpError(400, 'not_a_subscription')
  if (calendar.fetchedAt && Date.now() - calendar.fetchedAt < MANUAL_REFRESH_MIN_MS) throw new HttpError(429, 'refreshed_recently')
  // Per user as well, so twenty subscriptions do not mean twenty fetches a minute.
  if (!take(`refresh:${user.id}`, 4).ok) throw new HttpError(429, 'rate_limited')
  const result = await refreshSubscription(db, calendar)
  const view = listCalendarsForUser(db, user.id).find((c) => c.id === calendar.id) ?? null
  return json({ calendar: view, ok: result.ok, error: result.error, changed: result.changed, updatedAt: getCalendar(db, calendar.id)?.updatedAt ?? null })
})
