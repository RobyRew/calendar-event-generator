import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, json } from '@/server/http'
import { getPrefs } from '@/server/prefs'

// GET /api/prefs — the signed-in user's synced preferences: {settings, templates, hidden}, each {value, version}.
export const GET: APIRoute = handle(async ({ request }) => {
  const user = await requireUser(request)
  return json({ prefs: getPrefs(getDb(), user.id) })
})
