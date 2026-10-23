import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, HttpError, json, readJson } from '@/server/http'
import { calendarInput, subscriptionInput } from '@/server/schemas'
import { countOwnedCalendars, createCalendar, deleteCalendar, getCalendar, listCalendarsForUser, MAX_CALENDARS_PER_USER, updateCalendar } from '@/server/repo'
import { take } from '@/server/ratelimit'
import { countSubscriptions, MAX_SUBSCRIPTIONS_PER_USER, normalizeSourceUrl, refreshSubscription } from '@/server/subscriptions'

// /api/calendars
//   GET  — calendars the user owns or was invited to
//   POST {name, …}       — a new calendar
//   POST {sourceUrl, …}  — a subscription to an external .ics URL; fetched once
//                          before it is created, so a bad URL is reported right away

export const GET: APIRoute = handle(async ({ request }) => {
  const user = await requireUser(request)
  return json({ calendars: listCalendarsForUser(getDb(), user.id) })
})

export const POST: APIRoute = handle(async ({ request }) => {
  const user = await requireUser(request)
  const body = await readJson(request, z.union([subscriptionInput, calendarInput]))
  const db = getDb()
  if (countOwnedCalendars(db, user.id) >= MAX_CALENDARS_PER_USER) throw new HttpError(409, 'too_many_calendars')
  if ('sourceUrl' in body) {
    const sourceUrl = normalizeSourceUrl(body.sourceUrl)
    if (countSubscriptions(db, user.id) >= MAX_SUBSCRIPTIONS_PER_USER) throw new HttpError(409, 'too_many_subscriptions')
    // Each new subscription makes the server fetch and parse a URL; a couple a
    // minute per user keeps that from being used as a fetch relay or to load the server.
    const limit = take(`subscribe:${user.id}`, 2)
    if (!limit.ok) throw new HttpError(429, 'rate_limited')
    const created = createCalendar(db, user.id, { name: body.name || new URL(sourceUrl).hostname, color: body.color, timezone: body.timezone, sourceUrl })
    const result = await refreshSubscription(db, getCalendar(db, created.id)!)
    if (!result.ok) {
      deleteCalendar(db, created.id)
      throw new HttpError(400, 'fetch_failed', result.error ?? 'error')
    }
    if (!body.name && result.name) updateCalendar(db, created.id, { name: result.name.slice(0, 120) })
    return json({ calendar: listCalendarsForUser(db, user.id).find((c) => c.id === created.id) }, { status: 201 })
  }
  const cal = createCalendar(db, user.id, body)
  return json({ calendar: listCalendarsForUser(db, user.id).find((c) => c.id === cal.id) }, { status: 201 })
})
