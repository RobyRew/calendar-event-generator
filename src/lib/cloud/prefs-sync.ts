import type { AppSettings, EventTemplate } from '@/types'
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/lib/constants'
import { getCustomTemplates, onLocalChange, replaceCustomTemplates } from '@/lib/storage'
import { useSettingsStore } from '@/stores/settings-store'
import { onHiddenChanged, useAccountStore } from '@/stores/account-store'
import { api, ApiError, CLOUD, type PrefEntry, type PrefSection } from './api'

// Settings, custom templates and hidden calendars follow the account (server
// build, signed in). Each section has a server version, a local revision and a
// base: the value this device and the server last agreed on.
// - A local change raises the revision; the next sync uploads it against the
//   version last seen. A 409 (another device wrote first) is merged three ways
//   against the base, so each side keeps its own changes: a setting changed on
//   the other device, a template deleted here, a calendar shown again here.
// - With no local change, a newer server version replaces the local copy.
// - A device's very first sync (or after "clear all data") takes the account's
//   settings and adds its own templates and hidden calendars to the account's.
// - When a different user signs in on the same browser, that user's account
//   replaces the previous user's preferences here; nothing of the previous user
//   is uploaded into the new account.

const SECTIONS: PrefSection[] = ['settings', 'templates', 'hidden']

interface SectionState {
  version: number
  /** Raised on every local change. */
  rev: number
  /** The revision last uploaded (or taken from the server). */
  syncedRev: number
  /** The value this device and the server last agreed on; null before that. */
  base?: unknown
}

interface Meta {
  userId: string
  sections: Partial<Record<PrefSection, SectionState>>
}

function readMeta(): Meta | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.prefsSync)
    return raw ? (JSON.parse(raw) as Meta) : null
  } catch {
    return null
  }
}

function writeMeta(meta: Meta): void {
  try {
    localStorage.setItem(STORAGE_KEYS.prefsSync, JSON.stringify(meta))
  } catch { /* storage unavailable: syncs again from scratch next time */ }
}

const stateOf = (meta: Meta, s: PrefSection): SectionState => meta.sections[s] ?? { version: 0, rev: 0, syncedRev: 0 }

// ── Local values ────────────────────────────────────────────────────────────

async function readLocal(section: PrefSection): Promise<unknown> {
  if (section === 'settings') return { ...useSettingsStore.getState().settings }
  if (section === 'templates') return getCustomTemplates()
  return [...useAccountStore.getState().hidden]
}

/** Known settings keys with a value of the default's type; anything else from the server is ignored. */
export function sanitizeSettings(value: unknown): Partial<AppSettings> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!(k in DEFAULT_SETTINGS)) continue
    const def = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[k]
    if (Array.isArray(def) ? Array.isArray(v) && v.every((n) => typeof n === 'number') : typeof v === typeof def) out[k] = v
  }
  return out as Partial<AppSettings>
}

const fullSettings = (v: unknown): AppSettings => ({ ...DEFAULT_SETTINGS, ...sanitizeSettings(v) })
const templateList = (v: unknown): EventTemplate[] =>
  Array.isArray(v) ? (v.filter((t) => t && typeof t === 'object' && typeof (t as EventTemplate).id === 'string') as EventTemplate[]) : []
const stringList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

let applying = false

/**
 * Put a value from the account on this device. Only the settings store reports
 * changes synchronously (its subscription runs inside setAll), so only that call
 * is marked as "not a local change"; replacing templates and the hidden list does
 * not report a change at all. A flag held across the template write used to swallow
 * genuine local changes made meanwhile.
 */
async function applyLocal(section: PrefSection, value: unknown): Promise<void> {
  if (section === 'settings') {
    applying = true
    try {
      useSettingsStore.getState().setAll(sanitizeSettings(value))
    } finally {
      applying = false
    }
  } else if (section === 'templates') await replaceCustomTemplates(templateList(value))
  else useAccountStore.getState().setHidden(stringList(value))
}

/** The same value with object keys sorted, so equality ignores key order (the server reorders template keys). */
const sorted = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])]))
      : v
const same = (a: unknown, b: unknown) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))

/** Templates from both sides by id; for the same id, the later updatedAt wins (local on a tie). */
export function mergeTemplates(local: EventTemplate[], remote: EventTemplate[]): EventTemplate[] {
  const byId = new Map(remote.map((t) => [t.id, t]))
  for (const t of local) {
    const other = byId.get(t.id)
    if (!other || (t.updatedAt ?? '') >= (other.updatedAt ?? '')) byId.set(t.id, t)
  }
  return [...byId.values()]
}

/**
 * Combine a local and a server value that both moved on from `base`.
 * Settings: per key, a key changed here keeps this device's value, any other key
 * takes the server's. Templates: by id, deletions on either side stick unless the
 * other side edited that template; additions from both sides are kept. Hidden
 * calendars: the server's list, minus calendars shown again here, plus calendars
 * hidden here. With no base (a device's first sync), settings take the server's
 * value and the lists are combined.
 */
export function merge3(section: PrefSection, base: unknown, local: unknown, remote: unknown): unknown {
  if (section === 'settings') {
    const r = fullSettings(remote)
    if (base == null) return r
    const b = fullSettings(base)
    const l = fullSettings(local)
    const out: Record<string, unknown> = { ...r }
    for (const k of Object.keys(l) as (keyof AppSettings)[]) if (!same(l[k], b[k])) out[k] = l[k]
    return out
  }
  if (section === 'templates') {
    const l = templateList(local)
    const r = templateList(remote)
    if (base == null) return mergeTemplates(l, r)
    const b = new Map(templateList(base).map((t) => [t.id, t]))
    const lm = new Map(l.map((t) => [t.id, t]))
    const rm = new Map(r.map((t) => [t.id, t]))
    const out: EventTemplate[] = []
    for (const id of new Set([...lm.keys(), ...rm.keys()])) {
      const lt = lm.get(id)
      const rt = rm.get(id)
      const bt = b.get(id)
      if (lt && rt) out.push(bt && same(lt, bt) ? rt : bt && same(rt, bt) ? lt : mergeTemplates([lt], [rt])[0]!)
      else if (lt) { if (!bt || !same(lt, bt)) out.push(lt) } // deleted on the server unless edited here
      else if (rt) { if (!bt || !same(rt, bt)) out.push(rt) } // deleted here unless edited there
    }
    return out
  }
  const l = new Set(stringList(local))
  const r = stringList(remote)
  if (base == null) return [...new Set([...r, ...l])]
  const b = new Set(stringList(base))
  const shownHere = new Set([...b].filter((id) => !l.has(id)))
  const hiddenHere = [...l].filter((id) => !b.has(id))
  return [...new Set([...r.filter((id) => !shownHere.has(id)), ...hiddenHere])]
}

// ── Sync ────────────────────────────────────────────────────────────────────

/** Upload against `baseVersion`; on a 409, merge with the stored copy and upload once more. Returns what the server now holds. */
async function upload(section: PrefSection, value: unknown, baseVersion: number, base: unknown): Promise<PrefEntry> {
  try {
    return await api.putPref(section, value, baseVersion)
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 409) throw err
    const entry = err.data.entry as PrefEntry
    const merged = merge3(section, base, value, entry.value)
    if (!same(merged, value)) await applyLocal(section, merged)
    return api.putPref(section, merged, entry.version)
  }
}

type Mode = 'first' | 'switch' | 'normal'

async function syncSection(meta: Meta, section: PrefSection, server: PrefEntry | undefined, mode: Mode): Promise<void> {
  const st = stateOf(meta, section)
  const rev = st.rev
  const local = await readLocal(section)
  if (mode === 'switch') {
    // Another user's preferences are on this device: replace them with this
    // user's account copy (templates and hidden calendars are emptied when the
    // account has none; settings stay as they are until the account has some).
    if (server) await applyLocal(section, server.value)
    else if (section !== 'settings') await applyLocal(section, [])
    meta.sections[section] = { version: server?.version ?? 0, rev, syncedRev: rev, base: server?.value ?? null }
    return
  }
  if (mode === 'first') {
    if (!server) {
      const entry = await upload(section, local, 0, null)
      meta.sections[section] = { version: entry.version, rev, syncedRev: rev, base: entry.value }
      return
    }
    const merged = merge3(section, null, local, server.value)
    if (!same(merged, local)) await applyLocal(section, merged)
    const entry = same(merged, server.value) ? server : await upload(section, merged, server.version, server.value)
    meta.sections[section] = { version: entry.version, rev, syncedRev: rev, base: entry.value }
    return
  }
  if (st.rev !== st.syncedRev) {
    const entry = await upload(section, local, st.version, st.base ?? null)
    // syncedRev is the revision read before the upload; a change made meanwhile stays pending.
    meta.sections[section] = { version: entry.version, rev, syncedRev: rev, base: entry.value }
    return
  }
  if (server && server.version > st.version) {
    await applyLocal(section, server.value)
    meta.sections[section] = { ...st, version: server.version, base: server.value }
  }
}

let running: Promise<void> | null = null
let again = false

/** Bring this device and the account in line. Safe to call often; overlapping calls run once more afterwards. */
export function syncPrefs(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      const { status, user } = useAccountStore.getState()
      if (!CLOUD || status !== 'signedIn' || !user) return
      const prefs = await api.prefs()
      const stored = readMeta()
      const mode: Mode = !stored ? 'first' : stored.userId !== user.id ? 'switch' : 'normal'
      const meta: Meta = mode === 'normal' ? stored! : { userId: user.id, sections: {} }
      for (const section of SECTIONS) {
        try {
          await syncSection(meta, section, prefs[section], mode === 'normal' && !meta.sections[section] ? 'first' : mode)
        } catch (err) {
          console.error(`[prefs] ${section} sync failed:`, err)
        }
        // Keep revisions raised (by markChanged, in storage) while this ran, for every section.
        const latest = readMeta()
        if (latest && latest.userId === meta.userId) {
          for (const s of SECTIONS) {
            const cur = meta.sections[s]
            const raised = latest.sections[s]?.rev
            if (cur && raised !== undefined && raised > cur.rev) cur.rev = raised
          }
        }
        writeMeta(meta)
      }
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

let timer: ReturnType<typeof setTimeout> | null = null

/** Record a local change to a section and upload it shortly (only once a sync has set up this device). */
export function markChanged(section: PrefSection): void {
  if (applying) return
  const meta = readMeta()
  if (!meta) return // no baseline yet: the first sync decides
  const st = stateOf(meta, section)
  meta.sections[section] = { ...st, rev: st.rev + 1 }
  writeMeta(meta)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    syncPrefs().catch(() => {})
  }, 1500)
}

let started = false

/** Listen for local changes (server build only). */
export function startPrefsSync(): void {
  if (!CLOUD || started) return
  started = true
  useSettingsStore.subscribe((state, prev) => {
    if (state.settings !== prev.settings) markChanged('settings')
  })
  onHiddenChanged(() => markChanged('hidden'))
  onLocalChange((what) => markChanged(what))
}
