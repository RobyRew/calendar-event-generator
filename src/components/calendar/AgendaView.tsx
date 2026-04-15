import { useMemo } from 'react'
import { parseISO, compareAsc, format, isToday, isTomorrow, isYesterday } from 'date-fns'
import { useEventStore } from '@/stores/event-store'
import { useUIStore } from '@/stores/ui-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'
import { EventCard } from '@/components/event/EventCard'

export function AgendaView() {
  const { events } = useEventStore()
  const { openEditor } = useUIStore()
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)

  const grouped = useMemo(() => {
    const sorted = [...events].sort((a, b) => compareAsc(parseISO(a.startDate), parseISO(b.startDate)))
    const groups: Record<string, typeof events> = {}
    for (const event of sorted) {
      const key = format(parseISO(event.startDate), 'yyyy-MM-dd')
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    }
    return groups
  }, [events])

  const formatDayLabel = (dateKey: string) => {
    const date = parseISO(dateKey)
    if (isToday(date)) return t.today
    if (isTomorrow(date)) return t.tomorrow
    if (isYesterday(date)) return t.yesterday
    return format(date, 'EEEE, MMMM d, yyyy')
  }

  if (events.length === 0) {
    return <p className="text-sm text-text-3 text-center py-12">{t.noEvents}</p>
  }

  return (
    <div className="divide-y divide-border">
      {Object.entries(grouped).map(([dateKey, dayEvents]) => (
        <div key={dateKey} className="p-4">
          <h3 className="text-sm font-semibold text-text-2 mb-2 sticky top-0 bg-surface py-1">
            {formatDayLabel(dateKey)}
          </h3>
          <div className="space-y-2">
            {dayEvents.map((event) => (
              <EventCard
                key={event.uid}
                event={event}
                compact={settings.compactEventCards}
                onClick={() => openEditor(event.uid)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
