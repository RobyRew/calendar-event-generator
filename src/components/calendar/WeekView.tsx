import { useState } from 'react'
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  format, addWeeks, subWeeks, isSameDay, isToday, parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEventStore } from '@/stores/event-store'
import { useUIStore } from '@/stores/ui-store'
import { useSettingsStore } from '@/stores/settings-store'
import { cn, formatTime } from '@/lib/utils'

export function WeekView() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const { events } = useEventStore()
  const { openEditor } = useUIStore()
  const { settings } = useSettingsStore()

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: settings.firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: settings.firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const hours = Array.from({ length: 24 }, (_, i) => i)

  const eventsForDayHour = (day: Date, hour: number) =>
    events.filter((e) => {
      const start = parseISO(e.startDate)
      return isSameDay(start, day) && start.getHours() === hour
    })

  return (
    <div className="flex flex-col h-full">
      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} className="p-1.5 rounded-lg hover:bg-surface-2 text-text-2">
          <ChevronLeft size={20} />
        </button>
        <button onClick={() => setCurrentWeek(new Date())} className="text-base font-semibold text-text hover:text-accent transition-colors">
          {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
        </button>
        <button onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} className="p-1.5 rounded-lg hover:bg-surface-2 text-text-2">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-border shrink-0">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className={cn(
            'text-center py-1',
            isToday(day) && 'text-accent font-semibold',
          )}>
            <div className="text-xs text-text-3">{format(day, 'EEE')}</div>
            <div className={cn(
              'text-sm font-medium',
              isToday(day) ? 'bg-accent text-accent-text w-7 h-7 rounded-full flex items-center justify-center mx-auto' : 'text-text',
            )}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[50px_repeat(7,1fr)]">
          {hours.map((hour) => (
            <div key={hour} className="contents">
              <div className="text-xs text-text-3 text-right pr-2 py-2 border-b border-border/50">
                {formatTime(`2000-01-01T${String(hour).padStart(2, '0')}:00:00`, settings.timeFormat)}
              </div>
              {days.map((day) => {
                const hourEvents = eventsForDayHour(day, hour)
                return (
                  <div
                    key={day.toISOString() + hour}
                    className="border-b border-l border-border/30 min-h-[40px] p-0.5 hover:bg-surface-2/50 cursor-pointer transition-colors"
                    onClick={() => openEditor()}
                  >
                    {hourEvents.map((e) => (
                      <div
                        key={e.uid}
                        className="text-[10px] leading-tight truncate px-1 py-0.5 rounded mb-0.5"
                        style={{ backgroundColor: `${e.color || '#007aff'}30`, color: e.color || '#007aff' }}
                        onClick={(ev) => { ev.stopPropagation(); openEditor(e.uid) }}
                      >
                        {e.summary}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
