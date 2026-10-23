import { useState, useCallback, useEffect } from 'react'
import { Calendar, FileStack } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { useEventStore } from '@/stores/event-store'
import { useAccountStore, writableCalendars } from '@/stores/account-store'
import { CLOUD } from '@/lib/cloud/api'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations, t as translate } from '@/i18n'
import { parseICSFile } from '@/lib/ics-parser'
import { normalizeEvent } from '@/lib/normalize'
import { readFileAsText, generateUID } from '@/lib/utils'
import { putTemplate } from '@/lib/storage'
import { isUnchangedDuplicate } from '@/lib/import-rules'
import type { CalendarEvent, EventTemplate } from '@/types'



/** Identity of an event within one place (this device or one calendar). */
const idOf = (e: CalendarEvent) => `${e.uid}\u0000${e.recurrenceId}`

export function useImport() {
  const { events, importEvents, importToCalendar } = useEventStore()
  const { settings } = useSettingsStore()
  /** Where imported events go: '' = this device, otherwise an account calendar id. */
  const [target, setTarget] = useState('')
  // Resolves false when an account import failed (the store reports the error).
  const doImport = useCallback(
    async (list: CalendarEvent[]): Promise<boolean> => {
      if (!target) {
        await importEvents(list)
        return true
      }
      return importToCalendar(target, list)
    },
    [target, importEvents, importToCalendar],
  )

  const [importChoiceEvents, setImportChoiceEvents] = useState<CalendarEvent[] | null>(null)
  const [duplicateChoice, setDuplicateChoice] = useState<{
    duplicates: CalendarEvent[]
    fresh: CalendarEvent[]
  } | null>(null)

  /** Parse every file (the picker and drag & drop both allow several); extensions match case-insensitively. */
  const parseFiles = useCallback(async (files: File[]): Promise<CalendarEvent[]> => {
    const out: CalendarEvent[] = []
    for (const file of files) {
      const name = file.name.toLowerCase()
      if (name.endsWith('.ics') || name.endsWith('.ical') || name.endsWith('.ifb') || file.type === 'text/calendar') {
        out.push(...(await parseICSFile(file)).events)
      } else if (name.endsWith('.json') || file.type === 'application/json') {
        const data = JSON.parse(await readFileAsText(file)) as unknown
        const list = Array.isArray(data) ? data : ((data as { events?: unknown })?.events ?? [])
        if (Array.isArray(list)) out.push(...list.map((e) => normalizeEvent(e as Partial<CalendarEvent>)))
      }
    }
    return out
  }, [])

  const parseFile = useCallback((file: File) => parseFiles([file]), [parseFiles])

  const openImportChoice = useCallback((parsed: CalendarEvent[]) => {
    setImportChoiceEvents(parsed)
  }, [])

  const closeImportChoice = useCallback(() => {
    setImportChoiceEvents(null)
  }, [])

  const handleImportAsEvents = useCallback(async (): Promise<{ count: number } | null> => {
    if (!importChoiceEvents) return null

    // Duplicates are looked for where the events are going.
    const existingByKey = new Map(events.filter((e) => (e.calendarId ?? '') === target).map((e) => [idOf(e), e]))
    const duplicates = importChoiceEvents.filter((e) => existingByKey.has(idOf(e)))
    const fresh = importChoiceEvents.filter((e) => !existingByKey.has(idOf(e)))

    if (duplicates.length > 0) {
      const modifiedDuplicates: CalendarEvent[] = []
      const unmodifiedDuplicates: CalendarEvent[] = []

      for (const dup of duplicates) {
        const existing = existingByKey.get(idOf(dup))
        if (existing && !isUnchangedDuplicate(existing, dup, !!target)) {
          modifiedDuplicates.push({ ...dup, uid: generateUID(), recurrenceId: '' })
        } else {
          unmodifiedDuplicates.push(dup)
        }
      }

      if (modifiedDuplicates.length > 0) {
        if (!(await doImport([...fresh, ...modifiedDuplicates]))) return null
      }

      if (unmodifiedDuplicates.length > 0) {
        setDuplicateChoice({
          duplicates: unmodifiedDuplicates,
          fresh: modifiedDuplicates.length === 0 ? fresh : [],
        })
        setImportChoiceEvents(null)
        return null
      }

      if (fresh.length > 0 && modifiedDuplicates.length === 0) {
        if (!(await doImport(fresh))) return null
      }

      const total = fresh.length + modifiedDuplicates.length
      setImportChoiceEvents(null)
      return { count: total }
    }

    if (!(await doImport(importChoiceEvents))) return null
    const count = importChoiceEvents.length
    setImportChoiceEvents(null)
    return { count }
  }, [importChoiceEvents, events, target, doImport])

  const handleDuplicateOverwrite = useCallback(async (): Promise<{ count: number } | null> => {
    if (!duplicateChoice) return null
    const all = [...duplicateChoice.fresh, ...duplicateChoice.duplicates]
    if (!(await doImport(all))) return null
    const count = all.length
    setDuplicateChoice(null)
    return { count }
  }, [duplicateChoice, doImport])

  const handleDuplicateCreateNew = useCallback(async (): Promise<{ count: number } | null> => {
    if (!duplicateChoice) return null
    const renamed = duplicateChoice.duplicates.map((e) => ({ ...e, uid: generateUID(), recurrenceId: '' }))
    const all = [...duplicateChoice.fresh, ...renamed]
    if (!(await doImport(all))) return null
    const count = all.length
    setDuplicateChoice(null)
    return { count }
  }, [duplicateChoice, doImport])

  const handleImportAsTemplates = useCallback(async (): Promise<{ count: number } | null> => {
    if (!importChoiceEvents) return null
    for (const evt of importChoiceEvents) {
      const template: EventTemplate = {
        id: generateUID(),
        name: evt.summary || 'Imported Template',
        description: evt.description || '',
        icon: '📅',
        color: evt.color || settings.defaultCalendarColor,
        categories: evt.categories || [],
        isBuiltIn: false,
        event: {
          summary: evt.summary,
          description: evt.description,
          allDay: evt.allDay,
          timezone: evt.timezone,
          location: evt.location,
          color: evt.color,
          categories: evt.categories,
          priority: evt.priority,
          url: evt.url,
          classification: evt.classification,
          transparency: evt.transparency,
          alarms: evt.alarms,
          recurrenceRule: evt.recurrenceRule,
          attendees: evt.attendees,
          organizer: evt.organizer,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await putTemplate(template)
    }
    const count = importChoiceEvents.length
    setImportChoiceEvents(null)
    return { count }
  }, [importChoiceEvents, settings.defaultCalendarColor])

  return {
    target,
    setTarget,
    parseFile,
    parseFiles,
    importChoiceEvents,
    openImportChoice,
    closeImportChoice,
    duplicateChoice,
    setDuplicateChoice,
    handleImportAsEvents,
    handleImportAsTemplates,
    handleDuplicateOverwrite,
    handleDuplicateCreateNew,
  }
}

interface ImportModalsProps {
  hook: ReturnType<typeof useImport>
  onSuccess: (message: string) => void
}

export function ImportModals({ hook, onSuccess }: ImportModalsProps) {
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)

  const signedIn = useAccountStore((s) => s.status === 'signedIn')
  const calendars = useAccountStore((s) => s.calendars)
  const targets = CLOUD && signedIn ? writableCalendars(calendars) : []
  const {
    target,
    setTarget,
    importChoiceEvents,
    closeImportChoice,
    duplicateChoice,
    setDuplicateChoice,
    handleImportAsEvents,
    handleImportAsTemplates,
    handleDuplicateOverwrite,
    handleDuplicateCreateNew,
  } = hook
  // A calendar that went away (deleted, signed out) is no longer a target.
  const stale = !!target && !targets.some((c) => c.id === target)
  useEffect(() => {
    if (stale) setTarget('')
  }, [stale, setTarget])

  const wrapAction = async (action: () => Promise<{ count: number } | null>) => {
    const result = await action()
    if (result && result.count > 0) {
      onSuccess(translate(t, 'importSuccess', { count: result.count }))
    }
  }

  return (
    <>
      <Modal
        open={importChoiceEvents !== null}
        onClose={closeImportChoice}
        title={t.importChoice}
      >
        <div className="p-4 space-y-3">
          <p className="text-sm text-text-3">
            {translate(t, 'selectedCount', { count: importChoiceEvents?.length ?? 0 })}
          </p>
          {targets.length > 0 && (
            <Select
              label={t.importInto}
              value={targets.some((c) => c.id === target) ? target : ''}
              onChange={(e) => setTarget(e.target.value)}
              options={[{ value: '', label: t.onThisDevice }, ...targets.map((c) => ({ value: c.id, label: c.name }))]}
            />
          )}
          <Button
            variant="primary"
            onClick={() => wrapAction(handleImportAsEvents)}
            className="w-full justify-center"
          >
            <Calendar size={18} /> {t.importAsEvents}
          </Button>
          <Button
            variant="secondary"
            onClick={() => wrapAction(handleImportAsTemplates)}
            className="w-full justify-center"
          >
            <FileStack size={18} /> {t.importAsTemplates}
          </Button>
          <Button
            variant="ghost"
            onClick={closeImportChoice}
            className="w-full justify-center"
          >
            {t.cancel}
          </Button>
        </div>
      </Modal>

      <Modal
        open={duplicateChoice !== null}
        onClose={() => setDuplicateChoice(null)}
        title={t.importChoice}
      >
        <div className="p-4 space-y-3">
          <p className="text-sm text-text-3">
            {translate(t, 'importDuplicateFound', { count: duplicateChoice?.duplicates.length ?? 0 })}
          </p>
          <Button
            variant="primary"
            onClick={() => wrapAction(handleDuplicateOverwrite)}
            className="w-full justify-center"
          >
            {t.importOverwrite}
          </Button>
          <Button
            variant="secondary"
            onClick={() => wrapAction(handleDuplicateCreateNew)}
            className="w-full justify-center"
          >
            {t.importCreateNew}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setDuplicateChoice(null)}
            className="w-full justify-center"
          >
            {t.cancel}
          </Button>
        </div>
      </Modal>
    </>
  )
}
