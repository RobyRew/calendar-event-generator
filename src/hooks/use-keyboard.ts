import { useEffect } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useEventStore } from '@/stores/event-store'
import { usePlatform } from './use-platform'

export function useKeyboard() {
  const { modKey } = usePlatform()
  const ui = useUIStore()
  const events = useEventStore()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = modKey === 'Meta' ? e.metaKey : e.ctrlKey

      if (mod && e.key === 'k') {
        e.preventDefault()
        ui.setCommandPaletteOpen(!ui.isCommandPaletteOpen)
      }
      if (mod && e.key === 'n') {
        e.preventDefault()
        ui.openEditor()
      }
      if (mod && e.key === 'f') {
        e.preventDefault()
        ui.setSearchOpen(true)
      }
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        events.undo()
      }
      if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        events.redo()
      }
      if (mod && e.key === ',') {
        e.preventDefault()
        ui.setSettingsOpen(true)
      }
      if (e.key === 'Escape') {
        if (ui.isCommandPaletteOpen) ui.setCommandPaletteOpen(false)
        else if (ui.isSearchOpen) ui.setSearchOpen(false)
        else if (ui.isSettingsOpen) ui.setSettingsOpen(false)
        else if (ui.isEditorOpen) ui.closeEditor()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modKey, ui, events])
}
