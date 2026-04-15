import { MonthView } from './MonthView'
import { WeekView } from './WeekView'
import { DayView } from './DayView'
import { AgendaView } from './AgendaView'
import { useUIStore } from '@/stores/ui-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

const MODES = ['month', 'week', 'day', 'agenda'] as const

export function CalendarView() {
  const { calendarMode, setCalendarMode } = useUIStore()
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)

  const modeLabels: Record<string, string> = {
    month: t.month,
    week: t.week,
    day: t.day,
    agenda: t.agenda,
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mode selector */}
      <div className="flex items-center justify-center px-4 py-2 gap-1 shrink-0">
        {MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => setCalendarMode(mode)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              calendarMode === mode
                ? 'bg-accent text-accent-text'
                : 'text-text-2 hover:bg-surface-2',
            )}
          >
            {modeLabels[mode]}
          </button>
        ))}
      </div>

      {/* View */}
      <div className="flex-1 overflow-hidden">
        {calendarMode === 'month' && <MonthView />}
        {calendarMode === 'week' && <WeekView />}
        {calendarMode === 'day' && <DayView />}
        {calendarMode === 'agenda' && <AgendaView />}
      </div>
    </div>
  )
}
