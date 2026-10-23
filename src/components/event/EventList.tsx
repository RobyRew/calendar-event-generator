import { useMemo, useState } from 'react'
import { compareAsc } from 'date-fns'
import { Plus, Calendar as CalIcon, CheckSquare, FolderInput, CopyPlus, Trash2, X } from 'lucide-react'
import { useEventStore } from '@/stores/event-store'
import { useUIStore } from '@/stores/ui-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations, t as tr } from '@/i18n'
import { generateUID, eventKey, eventDisplayStart } from '@/lib/utils'
import { canEditCalendar, canEditEvent, duplicateCalendarId, useAccountStore } from '@/stores/account-store'
import { CLOUD } from '@/lib/cloud/api'
import { EventCard } from './EventCard'
import { EventEditor } from './EventEditor'
import { MoveDialog } from './MoveDialog'
import { Button } from '@/components/ui/Button'
import { useVisibleEvents } from '@/hooks/use-visible-events'
import type { CalendarEvent } from '@/types'

export function EventList() {
  const events = useVisibleEvents()
  const { addEvent, deleteEvent, deleteEvents } = useEventStore()
  const {
    openEditor, searchQuery, isEditorOpen, editingEventId, showToast,
    selecting, selectedKeys, startSelecting, toggleSelected, setSelected, stopSelecting,
  } = useUIStore()
  const { settings } = useSettingsStore()
  const signedIn = useAccountStore((s) => s.status === 'signedIn')
  const t = getTranslations(settings.language)
  const [dialog, setDialog] = useState<{ mode: 'move' | 'copy'; keys: string[] } | null>(null)
  // Moving and copying need somewhere else to go: an account (server build, signed in).
  const accounts = CLOUD && signedIn
  const canMove = (e: CalendarEvent) => accounts && canEditCalendar(e.calendarId)

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

  const selectedEvents = events.filter((e) => selectedKeys.includes(eventKey(e)))

  const deleteSelected = async () => {
    const count = selectedKeys.length
    if (!confirm(tr(t, 'deleteSelectedConfirm', { count }))) return
    if (await deleteEvents(selectedKeys)) {
      showToast(tr(t, 'deletedN', { count }), 'success')
      stopSelecting()
    }
  }

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
    if (selecting) return toggleSelected(key)
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
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-sm font-medium text-text-3">
          {selecting ? tr(t, 'selectedN', { count: selectedKeys.length }) : `${filtered.length} ${t.events.toLowerCase()}`}
        </h2>
        {selecting ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setSelected(selectedKeys.length === filtered.length ? [] : filtered.map(eventKey))}>
              {selectedKeys.length === filtered.length ? t.deselectAll : t.selectAll}
            </Button>
            <Button variant="ghost" size="sm" onClick={stopSelecting} aria-label={t.cancel}><X size={16} /></Button>
          </div>
        ) : (
          filtered.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => startSelecting()}>
              <CheckSquare size={16} /> {t.select}
            </Button>
          )
        )}
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
            onMove={canMove(event) ? () => setDialog({ mode: 'move', keys: [eventKey(event)] }) : undefined}
            onCopy={accounts ? () => setDialog({ mode: 'copy', keys: [eventKey(event)] }) : undefined}
            onSelect={selecting ? undefined : () => startSelecting(eventKey(event))}
            selecting={selecting}
            selected={selecting && selectedKeys.includes(eventKey(event))}
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

      {selecting && selectedKeys.length > 0 && (
        <div className="sticky bottom-20 md:bottom-4 z-30 flex items-center gap-2 rounded-xl border border-border bg-surface/95 backdrop-blur p-2 shadow-lg">
          {accounts && (
            <Button variant="secondary" size="sm" disabled={!selectedEvents.every(canMove)} onClick={() => setDialog({ mode: 'move', keys: selectedKeys })}>
              <FolderInput size={16} /> {t.moveTo}
            </Button>
          )}
          {accounts && (
            <Button variant="secondary" size="sm" onClick={() => setDialog({ mode: 'copy', keys: selectedKeys })}>
              <CopyPlus size={16} /> {t.copyTo}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="danger" size="sm" disabled={!selectedEvents.every(canEditEvent)} onClick={deleteSelected}>
            <Trash2 size={16} /> {t.delete}
          </Button>
        </div>
      )}

      {dialog && (
        <MoveDialog open mode={dialog.mode} keys={dialog.keys} onClose={() => setDialog(null)} onDone={stopSelecting} />
      )}
    </div>
  )
}
