import { useState, useCallback } from 'react'
import { Calendar, FileStack } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useEventStore } from '@/stores/event-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations, t as translate } from '@/i18n'
import { parseICS } from '@/lib/ics-parser'
import { readFileAsText, generateUID } from '@/lib/utils'
import { putTemplate } from '@/lib/storage'
import type { CalendarEvent, EventTemplate } from '@/types'

export function useImport() {
  const { events, importEvents } = useEventStore()
  const { settings } = useSettingsStore()

  const [importChoiceEvents, setImportChoiceEvents] = useState<CalendarEvent[] | null>(null)
  const [duplicateChoice, setDuplicateChoice] = useState<{
    duplicates: CalendarEvent[]
    fresh: CalendarEvent[]
  } | null>(null)

  const parseFile = useCallback(async (file: File): Promise<CalendarEvent[]> => {
    const text = await readFileAsText(file)
    if (file.name.endsWith('.ics')) {
      return parseICS(text).events
    } else if (file.name.endsWith('.json')) {
      const data = JSON.parse(text)
      return Array.isArray(data) ? data : data.events ?? []
    }
    return []
  }, [])

  const openImportChoice = useCallback((parsed: CalendarEvent[]) => {
    setImportChoiceEvents(parsed)
  }, [])

  const closeImportChoice = useCallback(() => {
    setImportChoiceEvents(null)
  }, [])

  const handleImportAsEvents = useCallback(async (): Promise<{ count: number } | null> => {
    if (!importChoiceEvents) return null

    const existingUids = new Set(events.map((e) => e.uid))
    const duplicates = importChoiceEvents.filter((e) => existingUids.has(e.uid))
    const fresh = importChoiceEvents.filter((e) => !existingUids.has(e.uid))

    if (duplicates.length > 0) {
      const modifiedDuplicates: CalendarEvent[] = []
      const unmodifiedDuplicates: CalendarEvent[] = []

      for (const dup of duplicates) {
        const existing = events.find((e) => e.uid === dup.uid)
        if (existing && existing.lastModified !== dup.lastModified) {
          modifiedDuplicates.push({ ...dup, uid: generateUID() })
        } else {
          unmodifiedDuplicates.push(dup)
        }
      }

      if (modifiedDuplicates.length > 0) {
        await importEvents([...fresh, ...modifiedDuplicates])
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
        await importEvents(fresh)
      }

      const total = fresh.length + modifiedDuplicates.length
      setImportChoiceEvents(null)
      return { count: total }
    }

    await importEvents(importChoiceEvents)
    const count = importChoiceEvents.length
    setImportChoiceEvents(null)
    return { count }
  }, [importChoiceEvents, events, importEvents])

  const handleDuplicateOverwrite = useCallback(async (): Promise<{ count: number } | null> => {
    if (!duplicateChoice) return null
    const all = [...duplicateChoice.fresh, ...duplicateChoice.duplicates]
    await importEvents(all)
    const count = all.length
    setDuplicateChoice(null)
    return { count }
  }, [duplicateChoice, importEvents])

  const handleDuplicateCreateNew = useCallback(async (): Promise<{ count: number } | null> => {
    if (!duplicateChoice) return null
    const renamed = duplicateChoice.duplicates.map((e) => ({ ...e, uid: generateUID() }))
    const all = [...duplicateChoice.fresh, ...renamed]
    await importEvents(all)
    const count = all.length
    setDuplicateChoice(null)
    return { count }
  }, [duplicateChoice, importEvents])

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
    parseFile,
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

  const {
    importChoiceEvents,
    closeImportChoice,
    duplicateChoice,
    setDuplicateChoice,
    handleImportAsEvents,
    handleImportAsTemplates,
    handleDuplicateOverwrite,
    handleDuplicateCreateNew,
  } = hook

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
