import type { APIRoute } from 'astro'
import { getAuth } from '@/server/auth'

const unavailable = () => new Response('Accounts are not configured on this server.', { status: 503 })

export const GET: APIRoute = (ctx) => getAuth()?.signOut(ctx) ?? unavailable()
export const POST: APIRoute = (ctx) => getAuth()?.signOut(ctx) ?? unavailable()
