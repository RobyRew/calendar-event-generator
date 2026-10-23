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
      // In a text field, ⌘Z/⌘⇧Z undo typing; they must not also undo saved events.
      const target = e.target as HTMLElement | null
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

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
      if (mod && !typing && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        events.undo()
      }
      if (mod && !typing && e.key.toLowerCase() === 'z' && e.shiftKey) {
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
        // Through the editor's own close, which asks before dropping unsaved
        // changes; closing directly lost them.
        else if (ui.isEditorOpen) window.dispatchEvent(new CustomEvent('calgen:request-close'))
        else if (ui.selecting) ui.stopSelecting()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modKey, ui, events])
}
