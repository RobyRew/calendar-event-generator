import type { APIRoute } from 'astro'
import { getAuth } from '@/server/auth'

const unavailable = () => new Response('Accounts are not configured on this server.', { status: 503 })

export const GET: APIRoute = (ctx) => getAuth()?.callback(ctx) ?? unavailable()
