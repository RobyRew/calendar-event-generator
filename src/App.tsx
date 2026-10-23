import { useEffect } from 'react'
import { useAccountStore } from '@/stores/account-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'
import { CLOUD } from '@/lib/cloud/api'
import { AppShell } from '@/components/layout/AppShell'
import { EventList } from '@/components/event/EventList'
import { CalendarView } from '@/components/calendar/CalendarView'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { TemplateSelector } from '@/components/templates/TemplateSelector'
import { ImportExportPanel } from '@/components/import-export/ImportExportPanel'
import { CommandPalette } from '@/components/common/CommandPalette'
import { AccountPanel } from '@/components/account/AccountPanel'
import { useUIStore } from '@/stores/ui-store'
import { useEventStore } from '@/stores/event-store'
import { useKeyboard } from '@/hooks/use-keyboard'
import { seedDefaultTemplates } from '@/lib/storage'
import { startPrefsSync, syncPrefs } from '@/lib/cloud/prefs-sync'

function AppContent() {
  const { activeView, toastMessage, toastType, clearToast } = useUIStore()

  return (
    <>
      {activeView === 'events' && <EventList />}
      {activeView === 'calendar' && <CalendarView />}
      {activeView === 'templates' && <TemplateSelector />}
      {activeView === 'import-export' && <ImportExportPanel />}
      {activeView === 'settings' && <SettingsPanel />}
      {activeView === 'account' && <AccountPanel />}

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

/** Account state and account events (server build): on start, and when the tab regains focus. */
function useCloudSync() {
  const loadAccount = useAccountStore((s) => s.load)
  const loadCloud = useEventStore((s) => s.loadCloud)
  const syncError = useEventStore((s) => s.syncError)
  const clearSyncError = useEventStore((s) => s.clearSyncError)
  const { showToast } = useUIStore()
  const language = useSettingsStore((s) => s.settings.language)

  useEffect(() => {
    if (!CLOUD) return
    const t = getTranslations(language)
    const params = new URLSearchParams(window.location.search)
    if (params.has('auth_error')) {
      showToast(t.authError, 'error')
      params.delete('auth_error')
      history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`)
    }
    startPrefsSync()
    let last = 0
    const sync = async () => {
      if (Date.now() - last < 30_000) return
      last = Date.now()
      await loadAccount()
      await loadCloud().catch(() => {})
      await syncPrefs().catch(() => {})
    }
    sync()
    const onVisible = () => document.visibilityState === 'visible' && sync()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!syncError) return
    const t = getTranslations(language)
    // The store keeps the API's error code; a few have their own explanation.
    const message = syncError === 'uid_exists' ? t.moveFailedExists : syncError === 'read_only' ? t.readOnlyEvent : t.syncError
    showToast(message, 'error')
    clearSyncError()
  }, [syncError, showToast, clearSyncError, language])
}

export default function App() {
  const loadEvents = useEventStore((s) => s.load)
  useKeyboard()
  useCloudSync()

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
