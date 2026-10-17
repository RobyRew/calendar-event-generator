import { useMemo } from 'react'
import { compareAsc } from 'date-fns'
import { Plus, Calendar as CalIcon } from 'lucide-react'
import { useEventStore } from '@/stores/event-store'
import { useUIStore } from '@/stores/ui-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'
import { generateUID, eventKey, eventDisplayStart } from '@/lib/utils'
import { duplicateCalendarId } from '@/stores/account-store'
import { EventCard } from './EventCard'
import { EventEditor } from './EventEditor'
import { Button } from '@/components/ui/Button'
import { useVisibleEvents } from '@/hooks/use-visible-events'

export function EventList() {
  const events = useVisibleEvents()
  const { addEvent, deleteEvent } = useEventStore()
  const { openEditor, searchQuery, isEditorOpen, editingEventId } = useUIStore()
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)

  const filtered = useMemo(() => {
    let list = [...events]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((e) =>
        e.summary.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.location?.text.toLowerCase().includes(q) ||
        e.categories.some((c) => c.toLowerCase().includes(q))
      )
    }
    list.sort((a, b) => compareAsc(eventDisplayStart(a), eventDisplayStart(b)))
    return list
  }, [events, searchQuery])

  const handleDuplicate = async (event: typeof events[0]) => {
    const newUid = generateUID()
    const duplicate = {
      ...event,
      calendarId: duplicateCalendarId(event.calendarId),
      uid: newUid,
      recurrenceId: '',
      sequence: 0,
      summary: `${event.summary} (copy)`,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }
    // Account events are keyed calendar/uid, so open by eventKey, not the bare UID.
    if (await addEvent(duplicate)) openEditor(eventKey(duplicate))
  }

  const handleCardClick = (key: string) => {
    if (isEditorOpen && editingEventId === key) {
      // Let the editor's close button handle it (which checks for unsaved changes)
      // Dispatch a custom event that EventEditor listens for
      window.dispatchEvent(new CustomEvent('calgen:request-close'))
    } else {
      openEditor(key)
    }
  }

  if (events.length === 0 && !isEditorOpen) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <CalIcon size={48} className="text-text-3 mb-4" />
        <h3 className="text-lg font-semibold text-text mb-1">{t.noEvents}</h3>
        <p className="text-sm text-text-3 mb-6 max-w-[260px]">{t.appDescription}</p>
        <Button variant="primary" onClick={() => openEditor()}>
          <Plus size={18} /> {t.newEvent}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-4 pb-24 md:pb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-text-3">
          {filtered.length} {t.events.toLowerCase()}
        </h2>
      </div>

      {/* New event editor at top */}
      {isEditorOpen && !editingEventId && (
        <EventEditor inline />
      )}

      {filtered.map((event) => (
        <div key={eventKey(event)}>
          <EventCard
            event={event}
            compact={settings.compactEventCards && !(isEditorOpen && editingEventId === eventKey(event))}
            onClick={() => handleCardClick(eventKey(event))}
            onEdit={() => handleCardClick(eventKey(event))}
            onDuplicate={() => handleDuplicate(event)}
            onDelete={() => deleteEvent(eventKey(event))}
          />
          {/* Inline editor below active card */}
          {isEditorOpen && editingEventId === eventKey(event) && (
            <div className="mt-2">
              <EventEditor inline />
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && searchQuery && (
        <p className="text-sm text-text-3 text-center py-8">{t.noResults}</p>
      )}
    </div>
  )
}
