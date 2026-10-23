import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventTemplate } from '@/types'

// Preferences that follow the account (src/lib/cloud/prefs-sync.ts), against an
// in-memory server that versions each section like src/server/prefs.ts.

const h = vi.hoisted(() => {
  const mem = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  }
  // The settings store sets data-theme on <html> when it loads and on every change.
  ;(globalThis as { document?: unknown }).document ??= { documentElement: { setAttribute: () => {} } }
  return {
    mem,
    server: {} as Record<string, { value: unknown; version: number }>,
    puts: [] as string[],
    templates: [] as EventTemplate[],
    /** When set, replaceCustomTemplates waits for it (to change things mid-apply). */
    templateGate: null as Promise<void> | null,
    listener: null as null | ((what: 'settings' | 'templates') => void),
  }
})

vi.mock('@/lib/cloud/api', () => {
  class ApiError extends Error {
    constructor(readonly status: number, readonly code: string, readonly data: Record<string, unknown> = {}) {
      super(code)
    }
  }
  return {
    CLOUD: true,
    ApiError,
    api: {
      prefs: async () => structuredClone(h.server),
      putPref: async (section: string, value: unknown, baseVersion: number) => {
        h.puts.push(`${section}@${baseVersion}`)
        const cur = h.server[section] ?? { value: null, version: 0 }
        if (cur.version !== baseVersion) throw new ApiError(409, 'conflict', { entry: structuredClone(cur) })
        h.server[section] = { value: structuredClone(value), version: cur.version + 1 }
        return structuredClone(h.server[section])
      },
    },
  }
})

vi.mock('@/lib/storage', () => ({
  loadSettings: () => ({}),
  saveSettings: () => {},
  getCustomTemplates: async () => structuredClone(h.templates),
  replaceCustomTemplates: async (list: EventTemplate[]) => {
    if (h.templateGate) await h.templateGate
    h.templates = structuredClone(list)
  },
  onLocalChange: (fn: typeof h.listener) => {
    h.listener = fn
  },
}))

const { useSettingsStore } = await import('@/stores/settings-store')
const { useAccountStore } = await import('@/stores/account-store')
const { DEFAULT_SETTINGS, STORAGE_KEYS } = await import('@/lib/constants')
const { syncPrefs, startPrefsSync, markChanged, mergeTemplates, sanitizeSettings, merge3 } = await import('@/lib/cloud/prefs-sync')

const tpl = (id: string, updatedAt = '2026-10-01T00:00:00.000Z', name = id): EventTemplate =>
  ({ id, name, description: '', icon: '', color: '#000000', categories: [], isBuiltIn: false, event: {}, updatedAt })

beforeEach(() => {
  h.mem.clear()
  h.server = {}
  h.puts.length = 0
  h.templates = []
  h.templateGate = null
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } })
  useAccountStore.setState({ status: 'signedIn', user: { id: 'u1', email: null, name: null }, calendars: [], shared: [], hidden: [] })
  startPrefsSync()
})

describe('preferences sync', () => {
  it('a first sync against an empty account uploads this device\'s preferences', async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, theme: 'dark' } })
    h.templates = [tpl('t1')]
    useAccountStore.setState({ hidden: ['local'] })
    await syncPrefs()
    expect(h.puts.sort()).toEqual(['hidden@0', 'settings@0', 'templates@0'])
    expect((h.server.settings!.value as { theme: string }).theme).toBe('dark')
    expect(h.server.templates!.value).toEqual([tpl('t1')])
    expect(h.server.hidden!.value).toEqual(['local'])
  })

  it('a new device takes the account\'s settings and merges templates and hidden calendars', async () => {
    h.server = {
      settings: { value: { ...DEFAULT_SETTINGS, theme: 'oled', language: 'es' }, version: 3 },
      templates: { value: [tpl('t-account')], version: 2 },
      hidden: { value: ['cal-a'], version: 1 },
    }
    h.templates = [tpl('t-device')]
    useAccountStore.setState({ hidden: ['local'] })
    await syncPrefs()
    expect(useSettingsStore.getState().settings.theme).toBe('oled')
    expect(useSettingsStore.getState().settings.language).toBe('es')
    expect(h.templates.map((t) => t.id).sort()).toEqual(['t-account', 't-device'])
    expect((h.server.templates!.value as EventTemplate[]).map((t) => t.id).sort()).toEqual(['t-account', 't-device'])
    expect(useAccountStore.getState().hidden.sort()).toEqual(['cal-a', 'local'])
    // The account's settings were not overwritten with this device's defaults.
    expect(h.puts).not.toContain('settings@3')
  })

  it('uploads a local change, and takes a newer account copy when nothing changed here', async () => {
    await syncPrefs()
    h.puts.length = 0
    useSettingsStore.getState().set('timeFormat', '12h')
    await syncPrefs()
    expect(h.puts).toEqual(['settings@1'])
    expect((h.server.settings!.value as { timeFormat: string }).timeFormat).toBe('12h')
    // Another device changes the theme.
    h.server.settings = { value: { ...(h.server.settings!.value as object), theme: 'dark' }, version: 5 }
    h.puts.length = 0
    await syncPrefs()
    expect(h.puts).toEqual([])
    expect(useSettingsStore.getState().settings.theme).toBe('dark')
  })

  it('merges templates when another device wrote first (409), instead of overwriting', async () => {
    h.templates = [tpl('t1')]
    await syncPrefs()
    // Device B adds t2 on the server; this device adds t3 meanwhile.
    h.server.templates = { value: [tpl('t1'), tpl('t2')], version: 2 }
    h.templates = [tpl('t1'), tpl('t3')]
    h.listener?.('templates')
    await syncPrefs()
    const ids = (h.server.templates!.value as EventTemplate[]).map((t) => t.id).sort()
    expect(ids).toEqual(['t1', 't2', 't3'])
    expect(h.templates.map((t) => t.id).sort()).toEqual(['t1', 't2', 't3'])
  })

  it('values applied from the account are not reported back as local changes', async () => {
    h.server = { settings: { value: { ...DEFAULT_SETTINGS, theme: 'dark' }, version: 1 } }
    await syncPrefs()
    h.puts.length = 0
    await syncPrefs()
    expect(h.puts).toEqual([])
  })

  it('without a sync baseline (never synced, or device cleared) a local change is not uploaded', () => {
    markChanged('settings')
    expect(h.mem.get(STORAGE_KEYS.prefsSync)).toBeUndefined()
  })

  it('a different user on the same device starts from that user\'s account', async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, theme: 'dark' } })
    await syncPrefs()
    useAccountStore.setState({ user: { id: 'u2', email: null, name: null } })
    h.server = { settings: { value: { ...DEFAULT_SETTINGS, theme: 'light' }, version: 9 } }
    await syncPrefs()
    expect(useSettingsStore.getState().settings.theme).toBe('light')
  })

  it('keeps only known settings of the right type, and the newer of two template versions', () => {
    expect(sanitizeSettings({ theme: 'dark', bogus: 1, defaultDuration: 'x', weekendDays: [0, 6] })).toEqual({ theme: 'dark', weekendDays: [0, 6] })
    const merged = mergeTemplates([tpl('a', '2026-10-02T00:00:00.000Z', 'local')], [tpl('a', '2026-10-01T00:00:00.000Z', 'remote'), tpl('b')])
    expect(merged.map((t) => [t.id, t.name])).toEqual([['a', 'local'], ['b', 'b']])
  })

  describe('review fixes (2026-10-22)', () => {
    it('another user signing in on this browser gets their own account\'s templates and hidden list, and nothing of the previous user is uploaded', async () => {
      h.templates = [tpl('alice-private')]
      useAccountStore.setState({ hidden: ['alice-cal'] })
      await syncPrefs() // Alice
      h.server = { templates: { value: [tpl('bob-t')], version: 4 } } // Bob's account
      h.puts.length = 0
      useAccountStore.setState({ user: { id: 'u2', email: null, name: null } })
      await syncPrefs()
      expect(h.templates.map((t) => t.id)).toEqual(['bob-t'])
      expect(useAccountStore.getState().hidden).toEqual([])
      expect(h.puts).toEqual([])
      expect((h.server.templates!.value as EventTemplate[]).map((t) => t.id)).toEqual(['bob-t'])
    })

    it('a settings conflict keeps the other device\'s change to a different key', async () => {
      await syncPrefs()
      // Device B changes the language; this device, not yet refreshed, changes the theme.
      h.server.settings = { value: { ...(h.server.settings!.value as object), language: 'es' }, version: 2 }
      useSettingsStore.getState().set('theme', 'dark')
      await syncPrefs()
      const stored = h.server.settings!.value as { theme: string; language: string }
      expect(stored).toMatchObject({ theme: 'dark', language: 'es' })
      expect(useSettingsStore.getState().settings).toMatchObject({ theme: 'dark', language: 'es' })
    })

    it('a template deleted here and a calendar shown again here stay that way through a conflict', async () => {
      h.templates = [tpl('t1'), tpl('t2')]
      useAccountStore.setState({ hidden: ['calX'] })
      await syncPrefs()
      // Elsewhere: t3 added, calY hidden. Here: t1 deleted, calX shown again.
      h.server.templates = { value: [tpl('t1'), tpl('t2'), tpl('t3')], version: 2 }
      h.server.hidden = { value: ['calX', 'calY'], version: 2 }
      h.templates = [tpl('t2')]
      h.listener?.('templates')
      useAccountStore.getState().toggleHidden('calX')
      await syncPrefs()
      expect((h.server.templates!.value as EventTemplate[]).map((t) => t.id).sort()).toEqual(['t2', 't3'])
      expect(h.server.hidden!.value).toEqual(['calY'])
    })

    it('a local change made while the account\'s templates are being written is still uploaded', async () => {
      await syncPrefs()
      let open!: () => void
      h.templateGate = new Promise((r) => (open = r))
      h.server.templates = { value: [tpl('remote')], version: 3 }
      const syncing = syncPrefs()
      await new Promise((r) => setTimeout(r, 10))
      useSettingsStore.getState().set('timeFormat', '12h') // during the template write
      open()
      await syncing
      h.templateGate = null
      await syncPrefs()
      expect((h.server.settings!.value as { timeFormat: string }).timeFormat).toBe('12h')
    })

    it('merge3 without a base combines lists and takes the account\'s settings', () => {
      expect(merge3('hidden', null, ['a'], ['b'])).toEqual(['b', 'a'])
      expect((merge3('settings', null, { theme: 'dark' }, { theme: 'light' }) as { theme: string }).theme).toBe('light')
    })
  })

  it('a template deleted elsewhere stays deleted even when the server stored its keys in another order', () => {
    const serverOrder = { id: 't1', isBuiltIn: false, name: 'A', description: '', icon: '', color: '#000000', categories: [], event: {} }
    const localOrder = { name: 'A', description: '', icon: '', color: '#000000', categories: [], isBuiltIn: false, event: {}, id: 't1' }
    const merged = merge3('templates', [serverOrder], [localOrder, tpl('t2')], []) as EventTemplate[]
    expect(merged.map((t) => t.id)).toEqual(['t2'])
  })
})
