import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useUIStore } from '@/stores/ui-store'
import { useEventStore } from '@/stores/event-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

interface CommandAction {
  id: string
  label: string
  description?: string
  action: () => void
  category: string
}

export function CommandPalette() {
  const { isCommandPaletteOpen, toggleCommandPalette, openEditor, setActiveView, toggleSearch } = useUIStore()
  const undo = useEventStore((s) => s.undo)
  const redo = useEventStore((s) => s.redo)
  const canUndo = useEventStore((s) => s.past.length > 0)
  const canRedo = useEventStore((s) => s.future.length > 0)
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: CommandAction[] = [
    { id: 'new-event', label: t.newEvent, category: t.events, action: () => { openEditor(); toggleCommandPalette() } },
    { id: 'search', label: t.search, category: t.events, action: () => { toggleSearch(); toggleCommandPalette() } },
    { id: 'view-events', label: t.events, category: t.navigation, action: () => { setActiveView('events'); toggleCommandPalette() } },
    { id: 'view-calendar', label: t.calendar, category: t.navigation, action: () => { setActiveView('calendar'); toggleCommandPalette() } },
    { id: 'view-templates', label: t.templates, category: t.navigation, action: () => { setActiveView('templates'); toggleCommandPalette() } },
    { id: 'view-import-export', label: t.importExport, category: t.navigation, action: () => { setActiveView('import-export'); toggleCommandPalette() } },
    { id: 'settings', label: t.settings, category: t.navigation, action: () => { setActiveView('settings'); toggleCommandPalette() } },
    ...(canUndo ? [{ id: 'undo', label: t.undo, category: t.actions, action: () => { undo(); toggleCommandPalette() } }] : []),
    ...(canRedo ? [{ id: 'redo', label: t.redo, category: t.actions, action: () => { redo(); toggleCommandPalette() } }] : []),
  ]

  const filtered = query
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands

  useEffect(() => {
    setSelectedIndex(0)
    setQuery('')
  }, [isCommandPaletteOpen])

  useEffect(() => {
    if (isCommandPaletteOpen) inputRef.current?.focus()
  }, [isCommandPaletteOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      filtered[selectedIndex].action()
    }
  }

  return (
    <Modal
      open={isCommandPaletteOpen}
      onClose={toggleCommandPalette}
      title=""
    >
      <div className="p-2">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Search size={16} className="text-text-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.commandPalette}
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-3 outline-none"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.map((cmd, idx) => (
            <button
              key={cmd.id}
              onClick={cmd.action}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors',
                idx === selectedIndex ? 'bg-accent/10 text-accent' : 'text-text hover:bg-surface-2',
              )}
            >
              <span className="font-medium">{cmd.label}</span>
              <span className="text-xs text-text-3">{cmd.category}</span>
            </button>
          ))}

          {filtered.length === 0 && (
            <p className="text-sm text-text-3 text-center py-4">{t.noResults}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
