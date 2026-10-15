import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, json, readJson } from '@/server/http'
import { calendarInput } from '@/server/schemas'
import { createCalendar, listCalendarsForUser } from '@/server/repo'

export const GET: APIRoute = handle(async ({ request }) => {
  const user = await requireUser(request)
  return json({ calendars: listCalendarsForUser(getDb(), user.id) })
})

export const POST: APIRoute = handle(async ({ request }) => {
  const user = await requireUser(request)
  const body = await readJson(request, calendarInput)
  const db = getDb()
  const cal = createCalendar(db, user.id, body)
  return json({ calendar: listCalendarsForUser(db, user.id).find((c) => c.id === cal.id) }, { status: 201 })
})
