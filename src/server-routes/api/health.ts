import type { APIRoute } from 'astro'

// Liveness for the container HEALTHCHECK and Dokploy. Deliberately independent of
// Logto and the database so an IdP outage does not restart-loop the app.
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
