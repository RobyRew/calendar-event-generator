import { randomBytes } from 'node:crypto'
import LogtoClient, { type IdTokenClaims, type LogtoConfig } from '@logto/node'

// Logto "Traditional Web" sign-in against the RobyRew IdP (auth.robyrew.com): the
// redirect, PKCE and token exchange happen server-side, tokens live in a
// server-side session store, and the browser only ever holds an opaque, httpOnly
// session-id cookie. Same flow as mapswitch's src/lib/auth, with three changes:
// __Host- cookie on https, a new session id after the callback, and a failed
// callback lands on /?auth_error=1 instead of restarting sign-in (which loops).

export type SessionData = Record<string, string>

/** Where OIDC tokens are kept, one JSON map per session id. */
export interface SessionStore {
  /** The session's data, or null when unknown or expired. */
  load(sid: string): SessionData | null | Promise<SessionData | null>
  save(sid: string, data: SessionData, expiresAt: number): void | Promise<void>
  drop(sid: string): void | Promise<void>
  /** Delete sessions that expired before `now` (called on sign-in). */
  prune?(now: number): void | Promise<void>
}

export type LogtoClaims = IdTokenClaims

/** The subset of Astro's APIContext the handlers use (keeps the package independent of Astro's version). */
export interface RouteContext {
  url: URL
  request: Request
  cookies: {
    get(name: string): { value: string } | undefined
    set(name: string, value: string, options: CookieOptions): void
    delete(name: string, options?: { path?: string }): void
  }
  redirect(path: string, status?: 301 | 302 | 303 | 307 | 308): Response
}

interface CookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict'
  path: string
  maxAge: number
}

type ClientAdapter = ConstructorParameters<typeof LogtoClient>[1]

export interface LogtoAuthOptions<User> {
  /** Logto endpoint, e.g. https://auth.robyrew.com (the SDK derives /oidc from discovery). */
  endpoint: string
  appId: string
  /** Traditional Web app secret: server env only, never in the client bundle. */
  appSecret: string
  /**
   * The app's public origin (https://calendar.robyrew.com). Behind Traefik the
   * request arrives as http://…, so redirect URIs are built from this instead.
   * An https origin also switches the cookies to Secure + the `__Host-` prefix.
   */
  publicOrigin: string
  /** Base name of the session cookie, e.g. 'cg_sid'. */
  cookieName: string
  store: SessionStore
  /** Map verified ID-token claims to the app's local user (upsert by `sub`). */
  resolveUser(claims: LogtoClaims): User | Promise<User>
  /** Extra scopes; `openid` is always requested by the SDK. Default: email, profile. */
  scopes?: string[]
  /** Session lifetime. Default 14 days. */
  sessionTtlMs?: number
  paths?: {
    /** Registered redirect URI path. Default /api/auth/callback. */
    callback?: string
    /** Where a failed callback lands (with ?auth_error=1). Default /. */
    afterError?: string
    /** Registered post-sign-out redirect path. Default /. */
    afterSignOut?: string
  }
  logger?: Pick<Console, 'error' | 'warn'>
  /** Test seam: override parts of the SDK adapter (e.g. `requester`). */
  adapter?: Partial<ClientAdapter>
}

/** Only same-site paths; blocks open redirects through ?returnTo=//evil.example. */
export function sanitizeReturnTo(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  return raw
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim())
      } catch {
        return null
      }
    }
  }
  return null
}

const newSessionId = () => randomBytes(24).toString('base64url')
const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

export function createLogtoAuth<User>(opts: LogtoAuthOptions<User>) {
  const origin = opts.publicOrigin.replace(/\/+$/, '')
  const secure = origin.startsWith('https:')
  // __Host- cookies must be Secure, Path=/ and host-only, so no sibling
  // subdomain can plant a session id for this app (session fixation).
  const cookieName = secure ? `__Host-${opts.cookieName}` : opts.cookieName
  const returnCookie = `${cookieName}_rt`
  const ttl = opts.sessionTtlMs ?? 14 * 86_400_000
  const callbackPath = opts.paths?.callback ?? '/api/auth/callback'
  const afterError = opts.paths?.afterError ?? '/'
  const afterSignOut = opts.paths?.afterSignOut ?? '/'
  const log = opts.logger ?? console
  const config: LogtoConfig = {
    endpoint: opts.endpoint,
    appId: opts.appId,
    appSecret: opts.appSecret,
    scopes: opts.scopes ?? ['email', 'profile'],
  }
  const cookie = (maxAgeMs: number): CookieOptions => ({
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  })

  async function storageFor(sid: string) {
    const data: SessionData = { ...((await opts.store.load(sid)) ?? {}) }
    const persist = () => opts.store.save(sid, data, Date.now() + ttl)
    return {
      data,
      storage: {
        async getItem(key: string) {
          return data[key] ?? null
        },
        async setItem(key: string, value: string) {
          data[key] = value
          await persist()
        },
        async removeItem(key: string) {
          delete data[key]
          await persist()
        },
      },
    }
  }

  async function clientFor(sid: string, navigate: (url: string) => void = () => {}) {
    const { data, storage } = await storageFor(sid)
    const client = new LogtoClient(config, { ...opts.adapter, navigate, storage })
    return { client, data }
  }

  /** The signed-in user for a request, or null. Never throws. */
  async function getUser(request: Request): Promise<User | null> {
    const sid = readCookie(request.headers.get('cookie'), cookieName)
    if (!sid) return null
    try {
      const { client } = await clientFor(sid)
      const { isAuthenticated, claims } = await client.getContext()
      if (!isAuthenticated || !claims) return null
      return await opts.resolveUser(claims)
    } catch (err) {
      log.error('[auth] getUser failed:', message(err))
      return null
    }
  }

  /** GET /api/auth/sign-in?returnTo=/path[&mode=signUp] */
  async function signIn(ctx: RouteContext): Promise<Response> {
    // A fresh pre-login session every time; the PKCE verifier and state live in it.
    const sid = newSessionId()
    ctx.cookies.set(cookieName, sid, cookie(ttl))
    ctx.cookies.set(returnCookie, sanitizeReturnTo(ctx.url.searchParams.get('returnTo')), cookie(10 * 60_000))
    try {
      await opts.store.prune?.(Date.now())
    } catch (err) {
      log.warn('[auth] session prune failed:', message(err))
    }
    let target = afterError
    const { client } = await clientFor(sid, (u) => {
      target = u
    })
    await client.signIn({
      redirectUri: `${origin}${callbackPath}`,
      ...(ctx.url.searchParams.get('mode') === 'signUp' ? { interactionMode: 'signUp' as const } : {}),
    })
    return ctx.redirect(target, 302)
  }

  /** GET /api/auth/callback — exchanges the code, then rotates the session id. */
  async function callback(ctx: RouteContext): Promise<Response> {
    const sid = ctx.cookies.get(cookieName)?.value
    const failed = () => ctx.redirect(`${afterError}${afterError.includes('?') ? '&' : '?'}auth_error=1`, 302)
    if (!sid) return failed()
    const { client, data } = await clientFor(sid)
    try {
      // Rebuild the callback URL from the public origin, keeping ?code&state.
      await client.handleSignInCallback(`${origin}${ctx.url.pathname}${ctx.url.search}`)
      const { claims } = await client.getContext()
      if (claims) await opts.resolveUser(claims)
    } catch (err) {
      // Land on a page instead of restarting sign-in: an automatic retry is how a
      // misconfigured app turns into an endless redirect loop.
      log.error('[auth] sign-in callback failed:', message(err))
      await opts.store.drop(sid)
      ctx.cookies.delete(cookieName, { path: '/' })
      return failed()
    }
    // New id for the authenticated session; the pre-login id stops working.
    const fresh = newSessionId()
    await opts.store.save(fresh, { ...data }, Date.now() + ttl)
    await opts.store.drop(sid)
    ctx.cookies.set(cookieName, fresh, cookie(ttl))
    const returnTo = sanitizeReturnTo(ctx.cookies.get(returnCookie)?.value)
    ctx.cookies.delete(returnCookie, { path: '/' })
    return ctx.redirect(returnTo, 302)
  }

  /** GET or POST /api/auth/sign-out — ends the Logto SSO session too, not just the local one. */
  async function signOut(ctx: RouteContext): Promise<Response> {
    const sid = ctx.cookies.get(cookieName)?.value
    let target = `${origin}${afterSignOut}`
    if (sid) {
      try {
        const { client } = await clientFor(sid, (u) => {
          target = u
        })
        await client.signOut(`${origin}${afterSignOut}`)
      } catch (err) {
        log.warn('[auth] Logto end-session failed (local session cleared anyway):', message(err))
      }
      await opts.store.drop(sid)
      ctx.cookies.delete(cookieName, { path: '/' })
    }
    return ctx.redirect(target, 302)
  }

  return { getUser, signIn, callback, signOut, cookieName }
}

export type LogtoAuth<User> = ReturnType<typeof createLogtoAuth<User>>
