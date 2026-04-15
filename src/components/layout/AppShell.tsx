import { useRef, useState, useCallback } from 'react'
import { Upload, Heart, Calendar, FileStack, Github } from 'lucide-react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useIsMobile } from '@/hooks/use-media-query'
import { useEventStore } from '@/stores/event-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import { getTranslations, t as translate } from '@/i18n'
import { parseICS } from '@/lib/ics-parser'
import { readFileAsText, generateUID } from '@/lib/utils'
import { putTemplate } from '@/lib/storage'
import type { CalendarEvent, EventTemplate } from '@/types'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile()
  const [isDragging, setIsDragging] = useState(false)
  const [importChoiceEvents, setImportChoiceEvents] = useState<CalendarEvent[] | null>(null)
  const dragCountRef = useRef(0)
  const { importEvents } = useEventStore()
  const { settings } = useSettingsStore()
  const { showToast } = useUIStore()
  const t = getTranslations(settings.language)

  const processFile = useCallback(async (file: File) => {
    try {
      let parsed: CalendarEvent[] = []
      if (file.name.endsWith('.ics')) {
        const text = await readFileAsText(file)
        const result = parseICS(text)
        parsed = result.events
      } else if (file.name.endsWith('.json')) {
        const text = await readFileAsText(file)
        const data = JSON.parse(text)
        parsed = Array.isArray(data) ? data : data.events ?? []
      }
      if (parsed.length === 0) {
        showToast(t.noEventsInFile, 'error')
        return
      }
      setImportChoiceEvents(parsed)
    } catch {
      showToast(t.importError, 'error')
    }
  }, [t, showToast])

  const handleImportAsEvents = async () => {
    if (!importChoiceEvents) return
    await importEvents(importChoiceEvents)
    showToast(translate(t, 'importSuccess', { count: importChoiceEvents.length }), 'success')
    setImportChoiceEvents(null)
  }

  const handleImportAsTemplates = async () => {
    if (!importChoiceEvents) return
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
    showToast(translate(t, 'importSuccess', { count: importChoiceEvents.length }), 'success')
    setImportChoiceEvents(null)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current--
    if (dragCountRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current = 0
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      await processFile(file)
    }
  }

  return (
    <div
      className="h-dvh flex flex-col bg-surface text-text overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Global drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-accent/10 border-2 border-dashed border-accent flex flex-col items-center justify-center gap-3 backdrop-blur-sm animate-fade-in pointer-events-none">
          <Upload size={48} className="text-accent" />
          <p className="text-lg font-semibold text-accent">{t.dragDropHint}</p>
          <p className="text-sm text-text-3">.ics, .json</p>
        </div>
      )}

      <Header />

      <div className="flex-1 flex overflow-hidden">
        {!isMobile && <Sidebar />}

        <main className="flex-1 overflow-y-auto">
          {children}

          {/* Credits */}
          <footer className="py-6 px-4 text-center text-xs text-text-3 border-t border-border/30 mt-8">
            <p className="flex items-center justify-center gap-1">
              Made with <Heart size={12} className="text-danger fill-danger" /> by{' '}
              <a
                href="https://github.com/RobyRew"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline font-medium"
              >
                RobyRew
              </a>
              <span className="text-border mx-1">·</span>
              <a
                href="https://github.com/RobyRew/calendar-event-generator"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-3 hover:text-accent transition-colors"
                title="View on GitHub"
              >
                <Github size={13} />
              </a>
            </p>
          </footer>
        </main>
      </div>

      {isMobile && <MobileNav />}

      {/* Import choice modal (drag & drop) */}
      <Modal
        open={importChoiceEvents !== null}
        onClose={() => setImportChoiceEvents(null)}
        title={t.importChoice}
      >
        <div className="p-4 space-y-3">
          <p className="text-sm text-text-3">
            {translate(t, 'selectedCount', { count: importChoiceEvents?.length ?? 0 })}
          </p>
          <Button
            variant="primary"
            onClick={handleImportAsEvents}
            className="w-full justify-center"
          >
            <Calendar size={18} /> {t.importAsEvents}
          </Button>
          <Button
            variant="secondary"
            onClick={handleImportAsTemplates}
            className="w-full justify-center"
          >
            <FileStack size={18} /> {t.importAsTemplates}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setImportChoiceEvents(null)}
            className="w-full justify-center"
          >
            {t.cancel}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
