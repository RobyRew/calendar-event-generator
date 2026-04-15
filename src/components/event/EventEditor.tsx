import { useState, useEffect, useCallback, useRef } from 'react'
import { format, parseISO, addMinutes } from 'date-fns'
import { Save, Trash2, Copy, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { TimePicker } from '@/components/ui/TimePicker'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { LocationEditor } from './LocationEditor'
import { RecurrenceEditor } from './RecurrenceEditor'
import { ReminderEditor } from './ReminderEditor'
import { AttendeeEditor } from './AttendeeEditor'
import type { CalendarEvent } from '@/types'
import { useEventStore } from '@/stores/event-store'
import { useUIStore } from '@/stores/ui-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'
import { createDefaultEvent, generateUID, cn } from '@/lib/utils'
import { COMMON_TIMEZONES } from '@/lib/constants'
import { useIsMobile } from '@/hooks/use-media-query'

interface EventEditorProps {
  inline?: boolean
}

export function EventEditor({ inline }: EventEditorProps) {
  const { events, addEvent, updateEvent, deleteEvent: removeEvent } = useEventStore()
  const { editingEventId, closeEditor } = useUIStore()
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)
  const isMobile = useIsMobile()

  const existingEvent = editingEventId ? events.find((e) => e.uid === editingEventId) : null
  const [event, setEvent] = useState<CalendarEvent>(() =>
    existingEvent ? { ...existingEvent } : createDefaultEvent({
      color: settings.defaultCalendarColor,
      timezone: settings.defaultTimezone,
      alarms: settings.defaultReminder >= 0
        ? [{ uid: generateUID(), action: 'DISPLAY', trigger: `-PT${settings.defaultReminder}M`, triggerRelation: 'START', description: 'Reminder', isDefault: true }]
        : [],
    })
  )
  const originalRef = useRef(JSON.stringify(existingEvent ?? event))

  useEffect(() => {
    if (existingEvent) {
      setEvent({ ...existingEvent })
      originalRef.current = JSON.stringify(existingEvent)
    }
  }, [existingEvent])

  const isDirty = JSON.stringify(event) !== originalRef.current

  const handleClose = useCallback(() => {
    if (isDirty) {
      if (!confirm(t.unsavedChanges)) return
    }
    closeEditor()
  }, [isDirty, t.unsavedChanges, closeEditor])

  // Listen for external close requests (e.g. clicking the same card again)
  useEffect(() => {
    const handler = () => handleClose()
    window.addEventListener('calgen:request-close', handler)
    return () => window.removeEventListener('calgen:request-close', handler)
  }, [handleClose])

  const update = useCallback(<K extends keyof CalendarEvent>(key: K, value: CalendarEvent[K]) => {
    setEvent((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = async () => {
    if (!event.summary.trim()) return
    if (editingEventId) {
      await updateEvent(event)
    } else {
      await addEvent(event)
    }
    closeEditor()
  }

  const handleDelete = async () => {
    if (!editingEventId) return
    if (settings.confirmBeforeDelete && !confirm(t.deleteEventConfirm)) return
    await removeEvent(editingEventId)
    closeEditor()
  }

  const handleDuplicate = async () => {
    const dup = createDefaultEvent({
      ...event,
      uid: generateUID(),
      summary: `${event.summary} (copy)`,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      sequence: 0,
    })
    await addEvent(dup)
    closeEditor()
  }

  const startDateStr = format(parseISO(event.startDate), 'yyyy-MM-dd')
  const endDateStr = format(parseISO(event.endDate), 'yyyy-MM-dd')
  const startTimeStr = format(parseISO(event.startDate), 'HH:mm')
  const endTimeStr = format(parseISO(event.endDate), 'HH:mm')

  const setStartDate = (dateStr: string) => {
    const [h, m] = startTimeStr.split(':').map(Number)
    const newStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
    if (isNaN(newStart.getTime())) return
    update('startDate', newStart.toISOString())
    if (newStart >= parseISO(event.endDate)) {
      update('endDate', addMinutes(newStart, settings.defaultDuration).toISOString())
    }
  }

  const setEndDate = (dateStr: string) => {
    const [h, m] = endTimeStr.split(':').map(Number)
    const newEnd = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
    if (isNaN(newEnd.getTime())) return
    update('endDate', newEnd.toISOString())
  }

  const setStartTime = (timeStr: string) => {
    const newStart = new Date(`${startDateStr}T${timeStr}:00`)
    if (isNaN(newStart.getTime())) return
    update('startDate', newStart.toISOString())
    if (newStart >= parseISO(event.endDate)) {
      update('endDate', addMinutes(newStart, settings.defaultDuration).toISOString())
    }
  }

  const setEndTime = (timeStr: string) => {
    const newEnd = new Date(`${endDateStr}T${timeStr}:00`)
    if (isNaN(newEnd.getTime())) return
    update('endDate', newEnd.toISOString())
  }

  const tabs = [
    { id: 'basic', label: isMobile ? '📝' : t.eventTitle },
    { id: 'datetime', label: isMobile ? '🕐' : t.startDate },
    { id: 'location', label: isMobile ? '📍' : t.location },
    { id: 'recurrence', label: isMobile ? '🔁' : t.recurrence },
    { id: 'reminders', label: isMobile ? '🔔' : t.reminders },
    { id: 'attendees', label: isMobile ? '👥' : t.attendees },
    { id: 'advanced', label: isMobile ? '⚙️' : t.advanced },
  ]

  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  // Track the pointer state at mount time — only auto-focus if no pointer is active
  // (i.e., the user opened via keyboard/button, not by clicking a card)
  const shouldAutoFocus = useRef(!editingEventId)

  useEffect(() => {
    if (inline && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (shouldAutoFocus.current) {
      const raf = requestAnimationFrame(() => {
        titleRef.current?.focus()
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [inline])

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col bg-surface',
        inline
          ? 'rounded-xl border border-accent/30 shadow-lg overflow-hidden animate-slide-down'
          : isMobile
            ? 'fixed inset-0 z-40'
            : '',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <button onClick={handleClose} className="text-accent text-sm font-medium">
          {isMobile ? t.cancel : <X size={20} />}
        </button>
        <h2 className="text-base font-semibold text-text">
          {editingEventId ? t.editEvent : t.newEvent}
        </h2>
        <button onClick={handleSave} className="text-accent text-sm font-semibold" disabled={!event.summary.trim()}>
          {t.save}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <Tabs tabs={tabs}>
          {(activeTab) => (
            <div className="animate-fade-in">
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <Input
                    ref={titleRef}
                    label={t.eventTitle}
                    placeholder={t.eventTitlePlaceholder}
                    value={event.summary}
                    onChange={(e) => update('summary', e.target.value)}
                  />
                  <Textarea
                    label={t.description}
                    placeholder={t.descriptionPlaceholder}
                    value={event.description}
                    onChange={(e) => update('description', e.target.value)}
                    rows={4}
                  />
                  <Input
                    label={t.url}
                    placeholder={t.urlPlaceholder}
                    type="url"
                    value={event.url}
                    onChange={(e) => update('url', e.target.value)}
                  />
                  <ColorPicker
                    label={t.color}
                    value={event.color}
                    onChange={(color) => update('color', color)}
                  />
                  <Input
                    label={t.categories}
                    placeholder={t.categoriesPlaceholder}
                    value={event.categories.join(', ')}
                    onChange={(e) => update('categories', e.target.value.split(',').map((c) => c.trim()).filter(Boolean))}
                  />
                </div>
              )}

              {activeTab === 'datetime' && (
                <div className="space-y-4">
                  <Toggle
                    label={t.allDay}
                    checked={event.allDay}
                    onChange={(checked) => update('allDay', checked)}
                  />
                  <Input
                    label={t.startDate}
                    type="date"
                    value={startDateStr}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  {!event.allDay && (
                    <TimePicker
                      label={t.startTime}
                      value={startTimeStr}
                      onChange={setStartTime}
                    />
                  )}
                  <Input
                    label={t.endDate}
                    type="date"
                    value={endDateStr}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  {!event.allDay && (
                    <TimePicker
                      label={t.endTime}
                      value={endTimeStr}
                      onChange={setEndTime}
                    />
                  )}
                  <Select
                    label={t.timezone}
                    options={COMMON_TIMEZONES.map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }))}
                    value={event.timezone}
                    onChange={(e) => update('timezone', e.target.value)}
                  />
                </div>
              )}

              {activeTab === 'location' && (
                <LocationEditor
                  location={event.location}
                  onChange={(loc) => update('location', loc)}
                />
              )}

              {activeTab === 'recurrence' && (
                <RecurrenceEditor
                  rule={event.recurrenceRule}
                  exceptions={event.recurrenceExceptions}
                  onChange={(rule) => update('recurrenceRule', rule)}
                  onExceptionsChange={(exs) => update('recurrenceExceptions', exs)}
                />
              )}

              {activeTab === 'reminders' && (
                <ReminderEditor
                  alarms={event.alarms}
                  onChange={(alarms) => update('alarms', alarms)}
                />
              )}

              {activeTab === 'attendees' && (
                <AttendeeEditor
                  organizer={event.organizer}
                  attendees={event.attendees}
                  onOrganizerChange={(org) => update('organizer', org)}
                  onAttendeesChange={(atts) => update('attendees', atts)}
                />
              )}

              {activeTab === 'advanced' && (
                <div className="space-y-4">
                  <Select
                    label={t.status}
                    options={[
                      { value: 'CONFIRMED', label: t.confirmed },
                      { value: 'TENTATIVE', label: t.tentative },
                      { value: 'CANCELLED', label: t.cancelled },
                    ]}
                    value={event.status}
                    onChange={(e) => update('status', e.target.value as CalendarEvent['status'])}
                  />
                  <Select
                    label={t.classification}
                    options={[
                      { value: 'PUBLIC', label: t.public_ },
                      { value: 'PRIVATE', label: t.private_ },
                      { value: 'CONFIDENTIAL', label: t.confidential },
                    ]}
                    value={event.classification}
                    onChange={(e) => update('classification', e.target.value as CalendarEvent['classification'])}
                  />
                  <Select
                    label={t.availability}
                    options={[
                      { value: 'OPAQUE', label: t.busy },
                      { value: 'TRANSPARENT', label: t.free },
                    ]}
                    value={event.transparency}
                    onChange={(e) => update('transparency', e.target.value as CalendarEvent['transparency'])}
                  />
                  <Select
                    label={t.priority}
                    options={[
                      { value: '0', label: t.priorityNone },
                      { value: '1', label: t.priorityHigh },
                      { value: '5', label: t.priorityMedium },
                      { value: '9', label: t.priorityLow },
                    ]}
                    value={String(event.priority)}
                    onChange={(e) => update('priority', parseInt(e.target.value))}
                  />
                  <Input
                    label={t.comment}
                    value={event.comment}
                    onChange={(e) => update('comment', e.target.value)}
                  />
                  <Input
                    label={t.contact}
                    value={event.contact}
                    onChange={(e) => update('contact', e.target.value)}
                  />
                  <Input
                    label={t.relatedTo}
                    value={event.relatedTo}
                    onChange={(e) => update('relatedTo', e.target.value)}
                  />
                  <Input
                    label={t.sequence}
                    type="number"
                    min={0}
                    value={event.sequence}
                    onChange={(e) => update('sequence', parseInt(e.target.value) || 0)}
                  />

                  {/* Apple Extensions */}
                  <div className="border-t border-border pt-4 mt-4">
                    <h4 className="text-sm font-medium text-text-2 mb-3">{t.appleExtensions}</h4>
                    <div className="space-y-3">
                      <Select
                        label={t.travelAdvisory}
                        options={[
                          { value: '', label: '—' },
                          { value: 'AUTOMATIC', label: t.travelAutomatic },
                          { value: 'DISABLED', label: t.travelDisabled },
                          { value: 'ENABLED', label: t.travelEnabled },
                        ]}
                        value={event.apple.travelAdvisory ?? ''}
                        onChange={(e) => update('apple', { ...event.apple, travelAdvisory: (e.target.value || undefined) as CalendarEvent['apple']['travelAdvisory'] })}
                      />
                      <Input
                        label={t.creatorIdentity}
                        value={event.apple.creatorIdentity ?? ''}
                        onChange={(e) => update('apple', { ...event.apple, creatorIdentity: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Google Extensions */}
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-medium text-text-2 mb-3">{t.googleExtensions}</h4>
                    <Input
                      label="Conference URL"
                      type="url"
                      value={event.google.conferenceUrl ?? ''}
                      onChange={(e) => update('google', { ...event.google, conferenceUrl: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </div>

      {/* Footer actions */}
      {editingEventId && (
        <div className="flex items-center gap-2 px-4 py-3 pb-4 border-t border-border shrink-0">
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 size={16} /> {t.delete}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDuplicate}>
            <Copy size={16} /> {t.duplicate}
          </Button>
          <div className="flex-1" />
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!event.summary.trim()}>
            <Save size={16} /> {t.save}
          </Button>
        </div>
      )}
    </div>
  )
}
