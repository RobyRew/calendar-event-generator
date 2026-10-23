import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { DB } from './db/client'
import { userPrefs } from './db/schema'
import { HttpError } from './http'

// Preferences that follow the account: settings, custom templates and which
// calendars are hidden. Each section carries a version; a client writes a section
// against the version it last saw, and gets 409 with the stored copy when another
// device wrote in between, so it can merge instead of overwriting. Versions come
// from the server, so device clocks do not decide which write wins.

export const PREF_SECTIONS = ['settings', 'templates', 'hidden'] as const
export type PrefSection = (typeof PREF_SECTIONS)[number]

export interface PrefEntry {
  value: unknown
  version: number
}

const settingValue = z.union([z.string().max(200), z.number(), z.boolean(), z.array(z.number()).max(7)])

export const prefValueSchemas: Record<PrefSection, z.ZodType> = {
  settings: z.record(z.string().max(64), settingValue).refine((o) => Object.keys(o).length <= 64, 'too many keys'),
  templates: z.array(z.looseObject({ id: z.string().min(1).max(100), isBuiltIn: z.literal(false).optional() })).max(200),
  hidden: z.array(z.string().max(100)).max(500),
}

/** Stored size limit for one section, in characters of JSON. */
export const MAX_PREF_SECTION_CHARS = 256 * 1024

type PrefsDoc = Partial<Record<PrefSection, PrefEntry>>

function load(db: DB, userId: string): PrefsDoc {
  const row = db.select().from(userPrefs).where(eq(userPrefs.userId, userId)).get()
  if (!row) return {}
  try {
    return JSON.parse(row.data) as PrefsDoc
  } catch {
    return {}
  }
}

export function getPrefs(db: DB, userId: string): PrefsDoc {
  return load(db, userId)
}

/**
 * Write one section if `baseVersion` is the stored version (0 when the section
 * was never written). Otherwise nothing changes and the stored entry is returned
 * with conflict: true.
 */
export function putPrefSection(db: DB, userId: string, section: PrefSection, value: unknown, baseVersion: number): { conflict: boolean; entry: PrefEntry } {
  if (JSON.stringify(value).length > MAX_PREF_SECTION_CHARS) throw new HttpError(413, 'too_large')
  return db.transaction(() => {
    const doc = load(db, userId)
    const current = doc[section] ?? { value: null, version: 0 }
    if (current.version !== baseVersion) return { conflict: true, entry: current }
    const entry = { value, version: current.version + 1 }
    const data = JSON.stringify({ ...doc, [section]: entry })
    const now = Date.now()
    db.insert(userPrefs)
      .values({ userId, data, updatedAt: now })
      .onConflictDoUpdate({ target: userPrefs.userId, set: { data, updatedAt: now } })
      .run()
    return { conflict: false, entry }
  })
}
