import {
  Calendar,
  LayoutList,
  FileStack,
  ArrowDownUp,
  Settings,
} from 'lucide-react'
import { useUIStore, type ActiveView } from '@/stores/ui-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { view: ActiveView; icon: typeof Calendar; labelKey: string }[] = [
  { view: 'events', icon: LayoutList, labelKey: 'events' },
  { view: 'calendar', icon: Calendar, labelKey: 'calendar' },
  { view: 'templates', icon: FileStack, labelKey: 'templates' },
  { view: 'import-export', icon: ArrowDownUp, labelKey: 'importExport' },
  { view: 'settings', icon: Settings, labelKey: 'settings' },
]

export function Sidebar() {
  const { activeView, setActiveView, isSidebarOpen } = useUIStore()
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)

  return (
    <aside
      className={cn(
        'bg-surface-2 border-r border-border flex flex-col shrink-0 transition-all duration-200 overflow-hidden',
        isSidebarOpen ? 'w-56' : 'w-0 border-0',
      )}
    >
      <nav className="flex-1 py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ view, icon: Icon, labelKey }) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              activeView === view
                ? 'bg-accent/15 text-accent'
                : 'text-text-2 hover:bg-surface-3 active:bg-surface-3',
            )}
          >
            <Icon size={18} />
            <span>{t[labelKey as keyof typeof t] as string}</span>
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <p className="text-xs text-text-3 text-center">CalGen v2.0</p>
      </div>
    </aside>
  )
}
