import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { requireUser } from '@/server/auth'
import { handle, json } from '@/server/http'
import { getShareLink, rotateShareLink } from '@/server/repo'
import { shareView } from '@/server/views'
import { manageable } from './share'

// POST /api/shares/[id]/rotate — a new URL for the same link; the old one stops working.
export const POST: APIRoute = handle(async ({ request, params }) => {
  const user = await requireUser(request)
  const db = getDb()
  const link = manageable(db, user.id, params.id!)
  rotateShareLink(db, link.id)
  return json({ share: shareView(db, getShareLink(db, link.id)!) })
})
