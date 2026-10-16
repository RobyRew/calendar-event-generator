import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createLogtoAuth, type LogtoAuth, type LogtoClaims } from './logto/client'
import { sqliteSessionStore } from './logto/sqlite-store'
import { getDatabase } from './db/client'
import { users, type UserRow } from './db/schema'
import { logtoEnv, publicOrigin } from './env'
import { HttpError } from './http'

export interface SessionUser {
  id: string
  email: string | null
  name: string | null
}

const toSessionUser = (u: UserRow): SessionUser => ({ id: u.id, email: u.email, name: u.name })

/** Local user row for verified Logto claims (created on first sign-in, profile cache refreshed). */
export function upsertUserFromClaims(claims: Pick<LogtoClaims, 'sub'> & { email?: string | null; name?: string | null; username?: string | null }): UserRow {
  const { db } = getDatabase()
  const email = claims.email ?? null
  const name = claims.name ?? claims.username ?? null
  const existing = db.select().from(users).where(eq(users.logtoSub, claims.sub)).get()
  if (existing) {
    if (existing.email !== email || existing.name !== name) {
      db.update(users).set({ email, name }).where(eq(users.id, existing.id)).run()
      return { ...existing, email, name }
    }
    return existing
  }
  db.insert(users)
    .values({ id: randomUUID(), logtoSub: claims.sub, email, name, createdAt: Date.now() })
    .onConflictDoNothing({ target: users.logtoSub })
    .run()
  return db.select().from(users).where(eq(users.logtoSub, claims.sub)).get()!
}

let auth: LogtoAuth<SessionUser> | null | undefined

/** The Logto integration, or null when LOGTO_* is not configured. */
export function getAuth(): LogtoAuth<SessionUser> | null {
  if (auth !== undefined) return auth
  const env = logtoEnv()
  auth = env
    ? createLogtoAuth<SessionUser>({
        ...env,
        publicOrigin: publicOrigin(),
        cookieName: 'cg_sid',
        store: sqliteSessionStore(getDatabase().sqlite),
        resolveUser: (claims) => toSessionUser(upsertUserFromClaims(claims)),
      })
    : null
  return auth
}

export async function currentUser(request: Request): Promise<SessionUser | null> {
  return (await getAuth()?.getUser(request)) ?? null
}

export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await currentUser(request)
  if (!user) throw new HttpError(401, 'unauthenticated')
  return user
}

/** Tests: reset the cached integration after changing env. */
export function resetAuthForTests() {
  auth = undefined
}
