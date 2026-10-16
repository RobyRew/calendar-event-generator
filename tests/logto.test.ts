import { describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { createLogtoAuth, readCookie, sanitizeReturnTo, type RouteContext } from '@/server/logto/client'
import { memorySessionStore, sqliteSessionStore } from '@/server/logto/sqlite-store'

const ENDPOINT = 'https://auth.example.test'
const discovery = {
  issuer: `${ENDPOINT}/oidc`,
  authorization_endpoint: `${ENDPOINT}/oidc/auth`,
  token_endpoint: `${ENDPOINT}/oidc/token`,
  end_session_endpoint: `${ENDPOINT}/oidc/session/end`,
  revocation_endpoint: `${ENDPOINT}/oidc/token/revocation`,
  jwks_uri: `${ENDPOINT}/oidc/jwks`,
  userinfo_endpoint: `${ENDPOINT}/oidc/me`,
}

function requester(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (input: unknown) => {
    const url = String(input)
    if (url.endsWith('/.well-known/openid-configuration')) return discovery
    if (url in overrides) {
      const v = overrides[url]
      if (v instanceof Error) throw v
      return v
    }
    throw new Error(`unexpected request ${url}`)
  })
}

function context(url: string, cookieJar: Record<string, string> = {}): RouteContext & { jar: Record<string, string>; location?: string } {
  const ctx = {
    url: new URL(url),
    request: new Request(url),
    jar: cookieJar,
    location: undefined as string | undefined,
    cookies: {
      get: (name: string) => (name in cookieJar ? { value: cookieJar[name]! } : undefined),
      set: (name: string, value: string) => void (cookieJar[name] = value),
      delete: (name: string) => void delete cookieJar[name],
    },
    redirect(path: string, status = 302) {
      ctx.location = path
      return new Response(null, { status, headers: { location: path } })
    },
  }
  return ctx
}

function setup(origin = 'https://app.example.test', extra: Record<string, unknown> = {}) {
  const store = memorySessionStore()
  const auth = createLogtoAuth({
    endpoint: ENDPOINT,
    appId: 'app-id',
    appSecret: 'secret',
    publicOrigin: origin,
    cookieName: 'cg_sid',
    store,
    resolveUser: (claims) => ({ id: claims.sub }),
    logger: { error: () => {}, warn: () => {} },
    adapter: { requester: requester(extra) as never },
  })
  return { auth, store }
}

describe('sanitizeReturnTo', () => {
  it('keeps local paths only', () => {
    expect(sanitizeReturnTo('/s/abc?x=1')).toBe('/s/abc?x=1')
    expect(sanitizeReturnTo('//evil.test')).toBe('/')
    expect(sanitizeReturnTo('/\\evil.test')).toBe('/')
    expect(sanitizeReturnTo('https://evil.test')).toBe('/')
    expect(sanitizeReturnTo(null)).toBe('/')
  })
})

describe('readCookie', () => {
  it('finds a cookie among others', () => {
    expect(readCookie('a=1; __Host-cg_sid=xyz; b=2', '__Host-cg_sid')).toBe('xyz')
    expect(readCookie('a=1', 'cg_sid')).toBeNull()
    expect(readCookie(null, 'cg_sid')).toBeNull()
  })
})

describe('sign-in', () => {
  it('sets a __Host- session cookie on https and redirects to Logto with PKCE', async () => {
    const { auth, store } = setup()
    const ctx = context('http://internal:4321/api/auth/sign-in?returnTo=/s/tok')
    await auth.signIn(ctx)
    expect(auth.cookieName).toBe('__Host-cg_sid')
    expect(ctx.jar['__Host-cg_sid']).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(ctx.jar['__Host-cg_sid_rt']).toBe('/s/tok')
    const target = new URL(ctx.location!)
    expect(target.origin + target.pathname).toBe(discovery.authorization_endpoint)
    // Built from the public origin, not the internal request origin.
    expect(target.searchParams.get('redirect_uri')).toBe('https://app.example.test/api/auth/callback')
    expect(target.searchParams.get('code_challenge_method')).toBe('S256')
    expect(store.size()).toBe(1)
  })

  it('uses a plain cookie name on http (local dev)', async () => {
    const { auth } = setup('http://localhost:5173')
    const ctx = context('http://localhost:5173/api/auth/sign-in')
    await auth.signIn(ctx)
    expect(ctx.jar['cg_sid']).toBeDefined()
  })

  it('starts a fresh session id on every sign-in', async () => {
    const { auth } = setup()
    const jar: Record<string, string> = { '__Host-cg_sid': 'planted-by-someone-else' }
    await auth.signIn(context('https://app.example.test/api/auth/sign-in', jar))
    expect(jar['__Host-cg_sid']).not.toBe('planted-by-someone-else')
  })
})

describe('callback', () => {
  it('lands on the error page (not back in sign-in) when the exchange fails', async () => {
    const { auth, store } = setup('https://app.example.test', { [discovery.token_endpoint]: new Error('invalid_grant') })
    const jar: Record<string, string> = {}
    await auth.signIn(context('https://app.example.test/api/auth/sign-in', jar))
    const ctx = context('https://app.example.test/api/auth/callback?code=bad&state=wrong', jar)
    await auth.callback(ctx)
    expect(ctx.location).toBe('/?auth_error=1')
    expect(jar['__Host-cg_sid']).toBeUndefined()
    expect(store.size()).toBe(0)
  })

  it('redirects to the error page without a session cookie', async () => {
    const { auth } = setup()
    const ctx = context('https://app.example.test/api/auth/callback?code=x&state=y')
    await auth.callback(ctx)
    expect(ctx.location).toBe('/?auth_error=1')
  })
})

describe('sign-out and getUser', () => {
  it('getUser is null without a session', async () => {
    const { auth } = setup()
    expect(await auth.getUser(new Request('https://app.example.test/api/me'))).toBeNull()
    expect(await auth.getUser(new Request('https://app.example.test/api/me', { headers: { cookie: '__Host-cg_sid=unknown' } }))).toBeNull()
  })

  it('drops the local session and clears the cookie', async () => {
    const { auth, store } = setup()
    const jar: Record<string, string> = {}
    await auth.signIn(context('https://app.example.test/api/auth/sign-in', jar))
    const ctx = context('https://app.example.test/api/auth/sign-out', jar)
    await auth.signOut(ctx)
    expect(jar['__Host-cg_sid']).toBeUndefined()
    expect(store.size()).toBe(0)
    expect(ctx.location).toBeDefined()
  })
})

describe('sqliteSessionStore', () => {
  it('saves, loads, expires and prunes', () => {
    const db = new Database(':memory:')
    const store = sqliteSessionStore(db, { createTable: true })
    const now = Date.now()
    store.save('a', { k: 'v' }, now + 60_000)
    store.save('old', { k: 'v' }, now - 1)
    expect(store.load('a')).toEqual({ k: 'v' })
    expect(store.load('old')).toBeNull()
    store.prune!(now)
    expect((db.prepare('SELECT COUNT(*) AS n FROM logto_sessions').get() as { n: number }).n).toBe(1)
    store.save('a', { k: 'w' }, now + 60_000)
    expect(store.load('a')).toEqual({ k: 'w' })
    store.drop('a')
    expect(store.load('a')).toBeNull()
  })

  it('accepts legacy column names and rejects unsafe identifiers', () => {
    const db = new Database(':memory:')
    db.exec('CREATE TABLE logto_sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL)')
    const store = sqliteSessionStore(db, { columns: { createdAt: 'createdAt', expiresAt: 'expiresAt' } })
    store.save('x', { a: '1' }, Date.now() + 1000)
    expect(store.load('x')).toEqual({ a: '1' })
    expect(() => sqliteSessionStore(db, { table: 'x; DROP TABLE y' })).toThrow(/invalid identifier/)
  })
})
