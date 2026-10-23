import type { SessionData, SessionStore } from './client'

/** Structural type for better-sqlite3's Database (no runtime dependency on it). */
export interface SqliteLike {
  prepare(sql: string): {
    get(...params: unknown[]): unknown
    run(...params: unknown[]): unknown
  }
  exec(sql: string): unknown
}

export interface SqliteStoreOptions {
  /** Default 'logto_sessions'. */
  table?: string
  /** Column names, for apps whose schema predates this package. */
  columns?: { id?: string; data?: string; createdAt?: string; expiresAt?: string }
  /**
   * Column that receives the ID token's subject (`sub`) on every save ('' before
   * sign-in), so all sessions of one user can be found through an index, e.g. to
   * end them when the account is deleted. Off when not set.
   */
  subjectColumn?: string
  /** Create the table if missing (otherwise the app's migrations own it). */
  createTable?: boolean
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

/** SessionStore on a SQLite table: id TEXT PK, data TEXT (JSON), created_at / expires_at INTEGER (ms). */
export function sqliteSessionStore(db: SqliteLike, options: SqliteStoreOptions = {}): SessionStore {
  const table = options.table ?? 'logto_sessions'
  const c = {
    id: options.columns?.id ?? 'id',
    data: options.columns?.data ?? 'data',
    createdAt: options.columns?.createdAt ?? 'created_at',
    expiresAt: options.columns?.expiresAt ?? 'expires_at',
  }
  const subject = options.subjectColumn
  for (const name of [table, ...Object.values(c), ...(subject ? [subject] : [])]) {
    // Identifiers cannot be bound as parameters, so they are validated instead.
    if (!IDENT.test(name)) throw new Error(`sqliteSessionStore: invalid identifier "${name}"`)
  }
  if (options.createTable) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (${c.id} TEXT PRIMARY KEY, ${c.data} TEXT NOT NULL, ${c.createdAt} INTEGER NOT NULL, ${c.expiresAt} INTEGER NOT NULL)`)
  }
  const get = db.prepare(`SELECT ${c.data} AS data, ${c.expiresAt} AS expiresAt FROM ${table} WHERE ${c.id} = ?`)
  const upsert = subject
    ? db.prepare(
        `INSERT INTO ${table} (${c.id}, ${c.data}, ${c.createdAt}, ${c.expiresAt}, ${subject}) VALUES (?, ?, ?, ?, ?) ` +
          `ON CONFLICT(${c.id}) DO UPDATE SET ${c.data} = excluded.${c.data}, ${c.expiresAt} = excluded.${c.expiresAt}, ${subject} = excluded.${subject}`,
      )
    : db.prepare(
        `INSERT INTO ${table} (${c.id}, ${c.data}, ${c.createdAt}, ${c.expiresAt}) VALUES (?, ?, ?, ?) ` +
          `ON CONFLICT(${c.id}) DO UPDATE SET ${c.data} = excluded.${c.data}, ${c.expiresAt} = excluded.${c.expiresAt}`,
      )
  const del = db.prepare(`DELETE FROM ${table} WHERE ${c.id} = ?`)
  const prune = db.prepare(`DELETE FROM ${table} WHERE ${c.expiresAt} < ?`)

  return {
    load(sid) {
      const row = get.get(sid) as { data: string; expiresAt: number } | undefined
      if (!row || row.expiresAt < Date.now()) return null
      try {
        return JSON.parse(row.data) as SessionData
      } catch {
        return null
      }
    },
    save(sid, data, expiresAt) {
      if (subject) upsert.run(sid, JSON.stringify(data), Date.now(), expiresAt, idTokenSubject(data.idToken) ?? '')
      else upsert.run(sid, JSON.stringify(data), Date.now(), expiresAt)
    },
    drop(sid) {
      del.run(sid)
    },
    prune(now) {
      prune.run(now)
    },
  }
}

/** The `sub` claim of an ID token, read without verifying it (the token was verified when it was issued to this server). */
export function idTokenSubject(token: string | undefined): string | null {
  const payload = token?.split('.')[1]
  if (!payload) return null
  try {
    const sub = (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: unknown }).sub
    return typeof sub === 'string' ? sub : null
  } catch {
    return null
  }
}

/** In-memory store for tests and local experiments. */
export function memorySessionStore(): SessionStore & { size(): number } {
  const rows = new Map<string, { data: SessionData; expiresAt: number }>()
  return {
    load: (sid) => {
      const row = rows.get(sid)
      return row && row.expiresAt >= Date.now() ? { ...row.data } : null
    },
    save: (sid, data, expiresAt) => void rows.set(sid, { data: { ...data }, expiresAt }),
    drop: (sid) => void rows.delete(sid),
    prune: (now) => {
      for (const [k, v] of rows) if (v.expiresAt < now) rows.delete(k)
    },
    size: () => rows.size,
  }
}
