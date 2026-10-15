import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export type DB = BetterSQLite3Database<typeof schema>

/** `file:/app/data/calendar.db` or a plain path. Defaults to ./data/calendar.db for local dev. */
export function databasePath(url = process.env.DB_URL): string {
  return (url || 'file:./data/calendar.db').replace(/^file:/, '')
}

export function openDatabase(path = databasePath()): { sqlite: Database.Database; db: DB } {
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  return { sqlite, db: drizzle(sqlite, { schema }) }
}

let instance: { sqlite: Database.Database; db: DB } | null = null

/** Process-wide connection (better-sqlite3 is synchronous; one handle is right). */
export function getDatabase() {
  instance ??= openDatabase()
  return instance
}

export const getDb = () => getDatabase().db

/** Tests swap in an in-memory database. */
export function setDatabaseForTests(next: { sqlite: Database.Database; db: DB } | null) {
  instance = next
}
