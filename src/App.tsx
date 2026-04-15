import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { EventList } from '@/components/event/EventList'
import { CalendarView } from '@/components/calendar/CalendarView'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { TemplateSelector } from '@/components/templates/TemplateSelector'
import { ImportExportPanel } from '@/components/import-export/ImportExportPanel'
import { CommandPalette } from '@/components/common/CommandPalette'
import { useUIStore } from '@/stores/ui-store'
import { useEventStore } from '@/stores/event-store'
import { useKeyboard } from '@/hooks/use-keyboard'
import { seedDefaultTemplates } from '@/lib/storage'

function AppContent() {
  const { activeView, toastMessage, toastType, clearToast } = useUIStore()

  return (
    <>
      {activeView === 'events' && <EventList />}
      {activeView === 'calendar' && <CalendarView />}
      {activeView === 'templates' && <TemplateSelector />}
      {activeView === 'import-export' && <ImportExportPanel />}
      {activeView === 'settings' && <SettingsPanel />}

      <CommandPalette />

      {/* Toast notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-slide-up ${
            toastType === 'error'
              ? 'bg-danger text-white'
              : toastType === 'success'
                ? 'bg-success text-white'
                : 'bg-surface-3 text-text'
          }`}
          onClick={clearToast}
        >
          {toastMessage}
        </div>
      )}
    </>
  )
}

export default function App() {
  const loadEvents = useEventStore((s) => s.load)
  useKeyboard()

  useEffect(() => {
    loadEvents()
    seedDefaultTemplates()
  }, [loadEvents])

  return (
    <AppShell>
      <AppContent />
    </AppShell>
  )
}
