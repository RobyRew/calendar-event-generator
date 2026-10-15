import type { APIRoute } from 'astro'
import { currentUser, getAuth } from '@/server/auth'
import { handle, json } from '@/server/http'

// Signed-in probe for the client island. `available: false` when Logto is not configured.
export const GET: APIRoute = handle(async ({ request }) => {
  const user = await currentUser(request)
  return json({ available: !!getAuth(), signedIn: !!user, user })
})
