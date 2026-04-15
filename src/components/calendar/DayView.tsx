import { useState } from 'react'
import { format, addDays, subDays, isSameDay, isToday, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEventStore } from '@/stores/event-store'
import { useUIStore } from '@/stores/ui-store'
import { useSettingsStore } from '@/stores/settings-store'
import { cn, formatTime } from '@/lib/utils'

export function DayView() {
  const [currentDay, setCurrentDay] = useState(new Date())
  const { events } = useEventStore()
  const { openEditor } = useUIStore()
  const { settings } = useSettingsStore()

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const dayEvents = events.filter((e) => isSameDay(parseISO(e.startDate), currentDay))
  const allDayEvents = dayEvents.filter((e) => e.allDay)
  const timedEvents = dayEvents.filter((e) => !e.allDay)

  return (
    <div className="flex flex-col h-full">
      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={() => setCurrentDay(subDays(currentDay, 1))} className="p-1.5 rounded-lg hover:bg-surface-2 text-text-2">
          <ChevronLeft size={20} />
        </button>
        <button onClick={() => setCurrentDay(new Date())} className={cn(
          'text-base font-semibold hover:text-accent transition-colors',
          isToday(currentDay) ? 'text-accent' : 'text-text',
        )}>
          {format(currentDay, 'EEEE, MMMM d, yyyy')}
        </button>
        <button onClick={() => setCurrentDay(addDays(currentDay, 1))} className="p-1.5 rounded-lg hover:bg-surface-2 text-text-2">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="px-4 py-2 border-b border-border space-y-1 shrink-0">
          {allDayEvents.map((e) => (
            <button
              key={e.uid}
              onClick={() => openEditor(e.uid)}
              className="block w-full text-left text-sm px-2 py-1 rounded-md truncate"
              style={{ backgroundColor: `${e.color || '#007aff'}20`, color: e.color || '#007aff' }}
            >
              {e.summary}
            </button>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          {hours.map((hour) => {
            const hourEvents = timedEvents.filter((e) => parseISO(e.startDate).getHours() === hour)
            return (
              <div
                key={hour}
                className="flex min-h-[48px] border-b border-border/30 hover:bg-surface-2/30 cursor-pointer transition-colors"
                onClick={() => openEditor()}
              >
                <div className="w-14 text-xs text-text-3 text-right pr-2 pt-1 shrink-0">
                  {formatTime(`2000-01-01T${String(hour).padStart(2, '0')}:00:00`, settings.timeFormat)}
                </div>
                <div className="flex-1 border-l border-border/30 px-1 py-0.5">
                  {hourEvents.map((e) => (
                    <button
                      key={e.uid}
                      onClick={(ev) => { ev.stopPropagation(); openEditor(e.uid) }}
                      className="block w-full text-left text-sm px-2 py-1 rounded-md mb-0.5 truncate"
                      style={{ backgroundColor: `${e.color || '#007aff'}20`, color: e.color || '#007aff' }}
                    >
                      {formatTime(e.startDate, settings.timeFormat)} {e.summary}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
