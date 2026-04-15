import { create } from 'zustand'
import type { CalendarViewMode, ActiveView } from '@/types'

export type { ActiveView }

interface UIState {
  activeView: ActiveView
  calendarMode: CalendarViewMode
  editingEventId: string | null
  isEditorOpen: boolean
  isSidebarOpen: boolean
  isSearchOpen: boolean
  isCommandPaletteOpen: boolean
  isSettingsOpen: boolean
  calendarDate: string
  selectedEventIds: string[]
  searchQuery: string
  toastMessage: string | null
  toastType: 'success' | 'error' | 'info'

  setActiveView: (view: ActiveView) => void
  setCalendarMode: (mode: CalendarViewMode) => void
  openEditor: (eventId?: string | null) => void
  closeEditor: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setCalendarDate: (date: string) => void
  setSelectedEventIds: (ids: string[]) => void
  toggleEventSelection: (id: string) => void
  setSearchQuery: (query: string) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  clearToast: () => void
  toggleSearch: () => void
  toggleCommandPalette: () => void
  toggleSettings: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  activeView: 'events',
  calendarMode: 'month',
  editingEventId: null,
  isEditorOpen: false,
  isSidebarOpen: true,
  isSearchOpen: false,
  isCommandPaletteOpen: false,
  isSettingsOpen: false,
  calendarDate: new Date().toISOString(),
  selectedEventIds: [],
  searchQuery: '',
  toastMessage: null,
  toastType: 'info',

  setActiveView: (view) => set({ activeView: view, isEditorOpen: false, editingEventId: null }),
  setCalendarMode: (mode) => set({ calendarMode: mode }),
  openEditor: (eventId) => set({ isEditorOpen: true, editingEventId: eventId ?? null, activeView: 'events' }),
  closeEditor: () => set({ isEditorOpen: false, editingEventId: null }),
  toggleSidebar: () => set({ isSidebarOpen: !get().isSidebarOpen }),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setCalendarDate: (date) => set({ calendarDate: date }),
  setSelectedEventIds: (ids) => set({ selectedEventIds: ids }),
  toggleEventSelection: (id) => {
    const { selectedEventIds } = get()
    if (selectedEventIds.includes(id)) {
      set({ selectedEventIds: selectedEventIds.filter((i) => i !== id) })
    } else {
      set({ selectedEventIds: [...selectedEventIds, id] })
    }
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  showToast: (message, type = 'info') => {
    set({ toastMessage: message, toastType: type })
    setTimeout(() => set({ toastMessage: null }), 3500)
  },
  clearToast: () => set({ toastMessage: null }),
  toggleSearch: () => set({ isSearchOpen: !get().isSearchOpen }),
  toggleCommandPalette: () => set({ isCommandPaletteOpen: !get().isCommandPaletteOpen }),
  toggleSettings: () => set({ isSettingsOpen: !get().isSettingsOpen }),
}))
