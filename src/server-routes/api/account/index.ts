import type { APIRoute } from 'astro'
import { getDb } from '@/server/db/client'
import { getAuth, requireUser } from '@/server/auth'
import { handle, json, readJson } from '@/server/http'
import { deleteAccount } from '@/server/account'
import { accountDelete } from '@/server/schemas'

// DELETE /api/account {confirm: 'DELETE'} — delete the user and everything they
// own here, end every session of theirs and clear this browser's session cookie.
export const DELETE: APIRoute = handle(async ({ request, cookies }) => {
  const user = await requireUser(request)
  await readJson(request, accountDelete)
  deleteAccount(getDb(), user.id)
  const name = getAuth()?.cookieName
  if (name) cookies.delete(name, { path: '/', secure: name.startsWith('__Host-') })
  return json({ ok: true })
})
