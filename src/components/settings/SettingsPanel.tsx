import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { useSettingsStore } from '@/stores/settings-store'
import { useEventStore } from '@/stores/event-store'
import { getTranslations } from '@/i18n'
import { COMMON_TIMEZONES, REMINDER_PRESETS, DURATION_PRESETS } from '@/lib/constants'
import { exportAllData, importAllData, getStorageEstimate } from '@/lib/storage'
import { downloadFile, readFileAsText } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { RotateCcw, Download, Upload, Trash2, HardDrive } from 'lucide-react'

export function SettingsPanel() {
  const { settings, set, resetAll } = useSettingsStore()
  const { clearAll } = useEventStore()
  const t = getTranslations(settings.language)
  const [storageUsed, setStorageUsed] = useState('')

  useEffect(() => {
    getStorageEstimate().then((est) => {
      if (est) {
        const mb = (est.usage / 1024 / 1024).toFixed(2)
        setStorageUsed(`${mb} MB`)
      }
    })
  }, [])

  const handleExportData = async () => {
    const data = await exportAllData()
    const json = JSON.stringify(data, null, 2)
    downloadFile(json, `calgen-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
  }

  const handleImportData = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await readFileAsText(file)
      await importAllData(text)
      location.reload()
    }
    input.click()
  }

  const handleClearAll = () => {
    if (confirm(t.clearAllConfirm)) {
      clearAll()
    }
  }

  const handleReset = () => {
    if (confirm(t.resetSettingsConfirm)) {
      resetAll()
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 pb-24 md:pb-4 space-y-6">
      <h2 className="text-xl font-bold text-text">{t.settings}</h2>

      {/* Appearance */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">{t.appearance}</h3>
        <Select
          label={t.theme}
          options={[
            { value: 'system', label: t.systemTheme },
            { value: 'light', label: t.lightTheme },
            { value: 'dark', label: t.darkTheme },
            { value: 'oled', label: t.oledTheme },
          ]}
          value={settings.theme}
          onChange={(e) => set('theme', e.target.value as typeof settings.theme)}
        />
        <Select
          label={t.language}
          options={[
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Español' },
            { value: 'ro', label: 'Română' },
          ]}
          value={settings.language}
          onChange={(e) => set('language', e.target.value as typeof settings.language)}
        />
        <Toggle
          label={t.compactCards}
          description={t.compactCardsDesc}
          checked={settings.compactEventCards}
          onChange={(v) => set('compactEventCards', v)}
        />
      </section>

      {/* Time & Date */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">{t.timeDate}</h3>
        <Select
          label={t.timeFormat}
          options={[
            { value: '24h', label: '24h (14:30)' },
            { value: '12h', label: '12h (2:30 PM)' },
          ]}
          value={settings.timeFormat}
          onChange={(e) => set('timeFormat', e.target.value as '12h' | '24h')}
        />
        <Select
          label={t.dateFormatSetting}
          options={[
            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
          ]}
          value={settings.dateFormat}
          onChange={(e) => set('dateFormat', e.target.value as typeof settings.dateFormat)}
        />
        <Select
          label={t.firstDayOfWeek}
          options={[
            { value: '0', label: t.sunday },
            { value: '1', label: t.monday },
            { value: '6', label: t.saturday },
          ]}
          value={String(settings.firstDayOfWeek)}
          onChange={(e) => set('firstDayOfWeek', parseInt(e.target.value) as typeof settings.firstDayOfWeek)}
        />
        <Toggle
          label={t.showWeekNumbers}
          checked={settings.showWeekNumbers}
          onChange={(v) => set('showWeekNumbers', v)}
        />
        <Select
          label={t.defaultTimezone}
          options={COMMON_TIMEZONES.map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }))}
          value={settings.defaultTimezone}
          onChange={(e) => set('defaultTimezone', e.target.value)}
        />
      </section>

      {/* Defaults */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">{t.defaults}</h3>
        <Select
          label={t.defaultDuration}
          options={DURATION_PRESETS.map((d) => ({ value: String(d.value), label: d.label }))}
          value={String(settings.defaultDuration)}
          onChange={(e) => set('defaultDuration', parseInt(e.target.value))}
        />
        <Select
          label={t.defaultReminder}
          options={[
            { value: '-1', label: t.noReminder },
            ...REMINDER_PRESETS.map((p) => ({
              value: String(p.value),
              label: 'count' in p
                ? (t[p.labelKey as keyof typeof t] as string)?.replace('{count}', String(p.count)) ?? `${p.count}`
                : t.atTimeOfEvent,
            })),
          ].filter(o => o.label)}
          value={String(settings.defaultReminder)}
          onChange={(e) => set('defaultReminder', parseInt(e.target.value))}
        />
        <ColorPicker
          label={t.defaultColor}
          value={settings.defaultCalendarColor}
          onChange={(color) => set('defaultCalendarColor', color)}
        />
        <Select
          label={t.defaultView}
          options={[
            { value: 'events', label: t.events },
            { value: 'month', label: t.month },
            { value: 'week', label: t.week },
            { value: 'day', label: t.day },
            { value: 'agenda', label: t.agenda },
          ]}
          value={settings.defaultView}
          onChange={(e) => set('defaultView', e.target.value as typeof settings.defaultView)}
        />
        <Select
          label={t.snapMinutesTo}
          options={[
            { value: '1', label: '1 min' },
            { value: '5', label: '5 min' },
            { value: '10', label: '10 min' },
            { value: '15', label: '15 min' },
            { value: '30', label: '30 min' },
          ]}
          value={String(settings.snapMinutesTo)}
          onChange={(e) => set('snapMinutesTo', parseInt(e.target.value) as typeof settings.snapMinutesTo)}
        />
      </section>

      {/* Behavior */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">{t.behavior}</h3>
        <Toggle
          label={t.confirmBeforeDelete}
          checked={settings.confirmBeforeDelete}
          onChange={(v) => set('confirmBeforeDelete', v)}
        />
        <Toggle
          label={t.exportWithApple}
          description={t.exportWithAppleDesc}
          checked={settings.exportAppleExtensions}
          onChange={(v) => set('exportAppleExtensions', v)}
        />
        <Toggle
          label={t.stripPersonalData}
          description={t.stripPersonalDataDesc}
          checked={settings.stripPersonalDataOnExport}
          onChange={(v) => set('stripPersonalDataOnExport', v)}
        />
      </section>

      {/* Data Management */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">{t.dataManagement}</h3>

        <div className="flex items-center gap-2 text-sm text-text-2">
          <HardDrive size={16} /> {t.storageUsed}: {storageUsed || '—'}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportData}>
            <Download size={16} /> {t.exportBackup}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleImportData}>
            <Upload size={16} /> {t.importBackup}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw size={16} /> {t.resetSettings}
          </Button>
          <Button variant="danger" size="sm" onClick={handleClearAll}>
            <Trash2 size={16} /> {t.clearAllData}
          </Button>
        </div>
      </section>

      {/* About */}
      <section className="text-center pt-4 border-t border-border">
        <p className="text-sm text-text-2 font-medium">{t.appName} v2.0</p>
        <p className="text-xs text-text-3 mt-1">{t.appDescription}</p>
      </section>
    </div>
  )
}
