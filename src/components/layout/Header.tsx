import { Menu, Plus, Search, X, Undo2, Redo2 } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useEventStore } from '@/stores/event-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'
import { useIsMobile } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

const logoUrl = new URL('/favicon.svg', import.meta.url).href

export function Header() {
  const {
    toggleSidebar,
    toggleSearch,
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    openEditor,
  } = useUIStore()
  const canUndo = useEventStore((s) => s.past.length > 0)
  const canRedo = useEventStore((s) => s.future.length > 0)
  const undo = useEventStore((s) => s.undo)
  const redo = useEventStore((s) => s.redo)
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)
  const isMobile = useIsMobile()

  return (
    <header className="h-12 flex items-center gap-2 px-3 border-b border-border bg-surface shrink-0 safe-top">
      {!isMobile && (
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-surface-2 text-text-2 transition-colors"
        >
          <Menu size={20} />
        </button>
      )}

      {isSearchOpen ? (
        <div className="flex-1 flex items-center gap-2 animate-fade-in">
          <Search size={16} className="text-text-3 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search}
            autoFocus
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-3 outline-none"
          />
          <button onClick={() => { setSearchQuery(''); toggleSearch() }} className="text-text-3">
            <X size={16} />
          </button>
        </div>
      ) : (
        <>
          <img src={logoUrl} alt="" className="w-6 h-6 shrink-0" />
          <h1 className="text-base font-semibold text-text flex-1">{t.appName}</h1>

          <div className="flex items-center gap-1">
            {!isMobile && (
              <>
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className={cn('p-1.5 rounded-lg transition-colors', canUndo ? 'hover:bg-surface-2 text-text-2' : 'text-text-3 opacity-40')}
                  title="Undo (⌘Z)"
                >
                  <Undo2 size={18} />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className={cn('p-1.5 rounded-lg transition-colors', canRedo ? 'hover:bg-surface-2 text-text-2' : 'text-text-3 opacity-40')}
                  title="Redo (⇧⌘Z)"
                >
                  <Redo2 size={18} />
                </button>
              </>
            )}

            <button
              onClick={toggleSearch}
              className="p-1.5 rounded-lg hover:bg-surface-2 text-text-2 transition-colors"
              title="Search (⌘F)"
            >
              <Search size={18} />
            </button>

            <button
              onClick={() => openEditor()}
              className="p-1.5 rounded-lg bg-accent text-accent-text hover:opacity-90 transition-opacity ml-1"
              title="New Event (⌘N)"
            >
              <Plus size={18} />
            </button>
          </div>
        </>
      )}
    </header>
  )
}
