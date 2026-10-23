import { create } from 'zustand'
import { api, CLOUD, type CloudCalendar, type Me, type SharedEntry } from '@/lib/cloud/api'

// Who is signed in and which account calendars they can see. Absent entirely in
// the static (GitHub Pages) build, where CLOUD is false and nothing calls /api.

export type AccountStatus = 'off' | 'loading' | 'unavailable' | 'signedOut' | 'signedIn'

const HIDDEN_KEY = 'calgen_hidden_calendars'

function loadHidden(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

interface AccountState {
  status: AccountStatus
  user: Me['user']
  calendars: CloudCalendar[]
  shared: SharedEntry[]
  /** Calendar ids ('local' = this device) whose events are hidden from the views. */
  hidden: string[]
  load: () => Promise<void>
  refresh: () => Promise<void>
  toggleHidden: (id: string) => void
  /** Replace the hidden list (preferences sync); does not count as a local change. */
  setHidden: (hidden: string[]) => void
}

export const useAccountStore = create<AccountState>((set, get) => ({
  status: CLOUD ? 'loading' : 'off',
  user: null,
  calendars: [],
  shared: [],
  hidden: loadHidden(),

  load: async () => {
    if (!CLOUD) return
    try {
      const me = await api.me()
      if (!me.available) return set({ status: 'unavailable' })
      if (!me.signedIn) return set({ status: 'signedOut', user: null, calendars: [], shared: [] })
      set({ status: 'signedIn', user: me.user })
      await get().refresh()
    } catch {
      // Offline or server unreachable: the app keeps working on this device.
      set({ status: 'unavailable' })
    }
  },

  refresh: async () => {
    if (get().status !== 'signedIn') return
    const [calendars, shared] = await Promise.all([api.calendars(), api.shared()])
    set({ calendars, shared })
  },

  toggleHidden: (id) => {
    const hidden = get().hidden.includes(id) ? get().hidden.filter((h) => h !== id) : [...get().hidden, id]
    get().setHidden(hidden)
    hiddenChanged()
  },

  setHidden: (hidden) => {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden))
    } catch { /* storage unavailable */ }
    set({ hidden })
  },
}))

let onHiddenChange: (() => void) | null = null
/** Preferences sync registers here to hear about local visibility changes. */
export function onHiddenChanged(fn: (() => void) | null): void {
  onHiddenChange = fn
}
function hiddenChanged() {
  onHiddenChange?.()
}

/** Calendars the user may add events to: owned or invited as editor, and not a subscription (read-only). */
export function writableCalendars(calendars: CloudCalendar[]): CloudCalendar[] {
  return calendars.filter((c) => (c.role === 'owner' || c.role === 'editor') && !c.sourceUrl)
}

/**
 * Whether the signed-in user may change this event: device events always; account
 * events when its calendar is writable, or when it was shared with them as editor.
 */
export function canEditEvent(e: { calendarId?: string; uid: string }): boolean {
  if (!e.calendarId) return true
  const { calendars, shared } = useAccountStore.getState()
  if (writableCalendars(calendars).some((c) => c.id === e.calendarId)) return true
  if (calendars.some((c) => c.id === e.calendarId && c.sourceUrl)) return false
  return shared.some((s) => s.calendarId === e.calendarId && s.uid === e.uid && s.role === 'editor')
}

/** Whether events of this calendar (undefined = this device) can be moved out of it: calendar-level write access. */
export function canEditCalendar(calendarId: string | undefined): boolean {
  if (!calendarId) return true
  return writableCalendars(useAccountStore.getState().calendars).some((c) => c.id === calendarId)
}

/**
 * Where a copy of an event goes: its own account calendar if the user may add
 * events there, otherwise this device (a viewer, or someone invited to a single
 * event, whose write to a new UID the server refuses). Shared by the list card
 * and the editor so their Duplicate buttons do the same thing.
 */
export function duplicateCalendarId(calendarId: string | undefined): string | undefined {
  if (!calendarId) return undefined
  return writableCalendars(useAccountStore.getState().calendars).some((c) => c.id === calendarId) ? calendarId : undefined
}
