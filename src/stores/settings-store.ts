import { create } from 'zustand'
import type { AppSettings, Theme } from '@/types'
import { loadSettings, saveSettings } from '@/lib/storage'
import { DEFAULT_SETTINGS } from '@/lib/constants'

interface SettingsState {
  settings: AppSettings
  resolvedTheme: 'light' | 'dark' | 'oled'
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  setAll: (partial: Partial<AppSettings>) => void
  resetAll: () => void
}

function resolveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark' | 'oled' {
  if (theme === 'system') return prefersDark ? 'dark' : 'light'
  return theme
}

const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
const initial = loadSettings()

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: initial,
  resolvedTheme: resolveTheme(initial.theme, prefersDark),
  set: (key, value) => {
    const next = { ...get().settings, [key]: value }
    saveSettings(next)
    const isDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    set({ settings: next, resolvedTheme: resolveTheme(next.theme, isDark) })
    applyTheme(resolveTheme(next.theme, isDark))
  },
  setAll: (partial) => {
    const next = { ...get().settings, ...partial }
    saveSettings(next)
    const isDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    set({ settings: next, resolvedTheme: resolveTheme(next.theme, isDark) })
    applyTheme(resolveTheme(next.theme, isDark))
  },
  resetAll: () => {
    saveSettings(DEFAULT_SETTINGS)
    const isDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    set({ settings: { ...DEFAULT_SETTINGS }, resolvedTheme: resolveTheme(DEFAULT_SETTINGS.theme, isDark) })
    applyTheme(resolveTheme(DEFAULT_SETTINGS.theme, isDark))
  },
}))

function applyTheme(theme: 'light' | 'dark' | 'oled') {
  document.documentElement.setAttribute('data-theme', theme)
}

// Listen for system theme changes
if (globalThis.matchMedia) {
  globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const state = useSettingsStore.getState()
    if (state.settings.theme === 'system') {
      const resolved = e.matches ? 'dark' : 'light'
      useSettingsStore.setState({ resolvedTheme: resolved })
      applyTheme(resolved)
    }
  })
}

// Apply initial theme
applyTheme(resolveTheme(initial.theme, prefersDark))
