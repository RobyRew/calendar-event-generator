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

const TABS: { view: ActiveView; icon: typeof Calendar; labelKey: string }[] = [
  { view: 'events', icon: LayoutList, labelKey: 'events' },
  { view: 'calendar', icon: Calendar, labelKey: 'calendar' },
  { view: 'templates', icon: FileStack, labelKey: 'templates' },
  { view: 'import-export', icon: ArrowDownUp, labelKey: 'importExport' },
  { view: 'settings', icon: Settings, labelKey: 'settings' },
]

export function MobileNav() {
  const { activeView, setActiveView } = useUIStore()
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-surface/90 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-12">
        {TABS.map(({ view, icon: Icon, labelKey }) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1 transition-colors min-w-[48px]',
              activeView === view ? 'text-accent' : 'text-text-3',
            )}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{t[labelKey as keyof typeof t] as string}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
