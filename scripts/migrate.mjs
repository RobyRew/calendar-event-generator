// Applies drizzle/ migrations before the server starts (Dockerfile CMD).
// Idempotent: already-applied migrations are skipped.
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

const path = (process.env.DB_URL || 'file:./data/calendar.db').replace(/^file:/, '')
mkdirSync(dirname(path), { recursive: true })
const sqlite = new Database(path)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
migrate(drizzle(sqlite), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname })
sqlite.close()
console.log(`migrations applied (${path})`)
