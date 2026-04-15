import { useState, useMemo } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  format, addMonths, subMonths, parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEventStore } from '@/stores/event-store'
import { useUIStore } from '@/stores/ui-store'
import { useSettingsStore } from '@/stores/settings-store'
import { cn } from '@/lib/utils'

export function MonthView() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const { events } = useEventStore()
  const { openEditor } = useUIStore()
  const { settings } = useSettingsStore()

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: settings.firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: settings.firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth, settings.firstDayOfWeek])

  const dayNames = useMemo(() => {
    const baseNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const shifted = []
    for (let i = 0; i < 7; i++) {
      shifted.push(baseNames[(settings.firstDayOfWeek + i) % 7])
    }
    return shifted
  }, [settings.firstDayOfWeek])

  const eventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(parseISO(e.startDate), day))

  return (
    <div className="flex flex-col h-full">
      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-surface-2 text-text-2">
          <ChevronLeft size={20} />
        </button>
        <button onClick={() => setCurrentMonth(new Date())} className="text-base font-semibold text-text hover:text-accent transition-colors">
          {format(currentMonth, 'MMMM yyyy')}
        </button>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-surface-2 text-text-2">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-2">
        {dayNames.map((name) => (
          <div key={name} className="text-xs font-medium text-text-3 text-center py-1">{name}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr px-2 pb-2 gap-px">
        {days.map((day) => {
          const dayEvents = eventsForDay(day)
          const inMonth = isSameMonth(day, currentMonth)
          const today = isToday(day)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'p-1 rounded-lg overflow-hidden transition-colors cursor-pointer',
                inMonth ? 'hover:bg-surface-2' : 'opacity-40',
              )}
              onClick={() => {
                if (dayEvents.length === 1) openEditor(dayEvents[0]!.uid)
                else if (dayEvents.length === 0) openEditor()
              }}
            >
              <div className={cn(
                'text-xs font-medium text-center mb-0.5',
                today ? 'bg-accent text-accent-text w-6 h-6 rounded-full flex items-center justify-center mx-auto' : 'text-text',
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <div
                    key={e.uid}
                    className="text-[10px] leading-tight truncate px-1 py-0.5 rounded"
                    style={{ backgroundColor: `${e.color || '#007aff'}20`, color: e.color || '#007aff' }}
                    onClick={(ev) => { ev.stopPropagation(); openEditor(e.uid) }}
                  >
                    {e.summary}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-text-3 text-center">+{dayEvents.length - 3}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
