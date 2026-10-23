import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, HttpError, json, readJson } from '@/server/http'
import { PREF_SECTIONS, prefValueSchemas, putPrefSection, type PrefSection } from '@/server/prefs'
import { prefPut } from '@/server/schemas'

// PUT /api/prefs/[section] {value, baseVersion} — write one section against the
// version the client last saw. 409 {error: 'conflict', entry} when it changed in
// between; the client merges and writes again.
export const PUT: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const section = params.section as PrefSection
  if (!(PREF_SECTIONS as readonly string[]).includes(section)) throw new HttpError(404, 'not_found')
  const { value, baseVersion } = await readJson(request, prefPut, 512 * 1024)
  const parsed = prefValueSchemas[section].safeParse(value)
  if (!parsed.success) throw new HttpError(400, 'invalid_body', z.prettifyError(parsed.error))
  const { conflict, entry } = putPrefSection(getDb(), user.id, section, parsed.data, baseVersion)
  if (conflict) return json({ error: 'conflict', entry }, { status: 409 })
  return json({ entry })
})
