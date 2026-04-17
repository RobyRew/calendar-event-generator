import { useState, useRef } from 'react'
import { Download, Link2, FileDown, FileUp, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { useEventStore } from '@/stores/event-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations, t as translate } from '@/i18n'
import { generateICS } from '@/lib/ics-generator'
import { getStoredTimezones } from '@/lib/ics-parser'
import { generateGoogleCalendarUrl, generateOutlookUrl, generateOffice365Url } from '@/lib/export-urls'
import { downloadFile } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useImport, ImportModals } from '@/hooks/use-import'

export function ImportExportPanel() {
  const { events } = useEventStore()
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importHook = useImport()

  const allSelected = events.length > 0 && selectedUids.size === events.length
  const noneSelected = selectedUids.size === 0

  const toggleUid = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelectedUids(new Set())
    } else {
      setSelectedUids(new Set(events.map((e) => e.uid)))
    }
  }

  const getExportEvents = () => {
    if (noneSelected) return events // export all if none explicitly selected
    return events.filter((e) => selectedUids.has(e.uid))
  }

  const handleExportICS = () => {
    try {
      const target = getExportEvents()
      const ics = generateICS(target, {
        includeAppleExtensions: settings.exportAppleExtensions,
        stripPersonalData: settings.stripPersonalDataOnExport,
        timezones: getStoredTimezones(),
      })
      downloadFile(ics, `events-${new Date().toISOString().slice(0, 10)}.ics`, 'text/calendar')
      setStatus({ type: 'success', message: t.exportSuccess })
    } catch {
      setStatus({ type: 'error', message: t.exportError })
    }
  }

  const handleExportJSON = () => {
    try {
      const target = getExportEvents()
      const json = JSON.stringify(target, null, 2)
      downloadFile(json, `events-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
      setStatus({ type: 'success', message: t.exportSuccess })
    } catch {
      setStatus({ type: 'error', message: t.exportError })
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = await importHook.parseFile(file)
      if (parsed.length === 0) {
        setStatus({ type: 'error', message: t.noEventsInFile })
      } else {
        importHook.openImportChoice(parsed)
      }
    } catch {
      setStatus({ type: 'error', message: t.importError })
    }
    e.target.value = ''
  }

  const selectedForLinks = selectedUids.size === 1
    ? events.find((e) => selectedUids.has(e.uid)) ?? null
    : null

  const tabs = [
    { id: 'export', label: t.export },
    { id: 'import', label: t.import },
    { id: 'links', label: t.shareLinks },
  ]

  return (
    <div className="max-w-xl mx-auto p-4 pb-24 md:pb-4 space-y-4">
      <h2 className="text-xl font-bold text-text">{t.importExport}</h2>

      {/* Status message */}
      {status && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm animate-slide-down ${
          status.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
        }`}>
          {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {status.message}
          <button onClick={() => setStatus(null)} className="ml-auto text-xs">✕</button>
        </div>
      )}

      <Tabs tabs={tabs}>
        {(activeTab) => (
          <div className="space-y-4">
            {activeTab === 'export' && (
              <>
                {/* Event selection list */}
                {events.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-text-3">
                        {t.selectEventsToExport}
                        {selectedUids.size > 0 && (
                          <span className="text-accent ml-1">
                            — {translate(t, 'selectedCount', { count: selectedUids.size })}
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-xs text-accent hover:underline"
                      >
                        {allSelected ? t.deselectAll : t.selectAll}
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/30">
                      {events.map((event) => (
                        <label
                          key={event.uid}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                            'hover:bg-surface-2',
                            selectedUids.has(event.uid) && 'bg-accent/5',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedUids.has(event.uid)}
                            onChange={() => toggleUid(event.uid)}
                            className="accent-accent w-4 h-4 rounded shrink-0"
                          />
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: event.color || '#007aff' }}
                          />
                          <span className="text-sm text-text truncate flex-1">
                            {event.summary || '(untitled)'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <Button variant="primary" onClick={handleExportICS} className="w-full justify-center">
                  <FileDown size={18} />{' '}
                  {noneSelected
                    ? `${t.exportICS} (${t.allEvents.toLowerCase()})`
                    : `${t.exportICS} (${selectedUids.size})`}
                </Button>
                <Button variant="secondary" onClick={handleExportJSON} className="w-full justify-center">
                  <Download size={18} />{' '}
                  {noneSelected
                    ? `${t.exportJSON} (${t.allEvents.toLowerCase()})`
                    : `${t.exportJSON} (${selectedUids.size})`}
                </Button>
              </>
            )}

            {activeTab === 'import' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ics,.json"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'w-full flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-all duration-200',
                    'hover:border-accent hover:bg-accent/5 active:scale-[0.98]',
                    'border-border text-text-3',
                  )}
                >
                  <FileUp size={32} className="text-text-3" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-text">{t.importFile}</p>
                    <p className="text-xs text-text-3 mt-1">{t.dragDropHint}</p>
                    <p className="text-xs text-text-3 mt-0.5">{t.importFileDesc}</p>
                  </div>
                </button>
              </>
            )}

            {activeTab === 'links' && selectedForLinks && (
              <div className="space-y-3">
                <a
                  href={generateGoogleCalendarUrl(selectedForLinks)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm font-medium text-text transition-colors"
                >
                  <Link2 size={16} className="text-accent" /> Google Calendar
                </a>
                <a
                  href={generateOutlookUrl(selectedForLinks)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm font-medium text-text transition-colors"
                >
                  <Link2 size={16} className="text-accent" /> Outlook.com
                </a>
                <a
                  href={generateOffice365Url(selectedForLinks)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm font-medium text-text transition-colors"
                >
                  <Link2 size={16} className="text-accent" /> Office 365
                </a>
              </div>
            )}

            {activeTab === 'links' && !selectedForLinks && (
              <p className="text-sm text-text-3 text-center py-4">{t.selectSingleEvent}</p>
            )}
          </div>
        )}
      </Tabs>

      <ImportModals
        hook={importHook}
        onSuccess={(msg) => setStatus({ type: 'success', message: msg })}
      />
    </div>
  )
}
