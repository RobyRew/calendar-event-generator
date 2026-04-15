import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import type { EventAlarm } from '@/types'
import { generateUID } from '@/lib/utils'
import { REMINDER_PRESETS, APPLE_ALARM_SOUNDS } from '@/lib/constants'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'
import { Toggle } from '@/components/ui/Toggle'

interface ReminderEditorProps {
  alarms: EventAlarm[]
  onChange: (alarms: EventAlarm[]) => void
}

export function ReminderEditor({ alarms, onChange }: ReminderEditorProps) {
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)

  const addAlarm = () => {
    onChange([...alarms, {
      uid: generateUID(),
      action: 'DISPLAY',
      trigger: '-PT30M',
      triggerRelation: 'START',
      description: 'Reminder',
      isDefault: false,
    }])
  }

  const removeAlarm = (idx: number) => {
    onChange(alarms.filter((_, i) => i !== idx))
  }

  const updateAlarm = (idx: number, partial: Partial<EventAlarm>) => {
    onChange(alarms.map((a, i) => i === idx ? { ...a, ...partial } : a))
  }

  const triggerOptions = REMINDER_PRESETS.map((p) => ({
    value: p.value === 0 ? 'PT0M' : `-PT${p.value >= 1440 ? `${p.value / 1440}D` : p.value >= 60 ? `${p.value / 60}H` : `${p.value}M`}`.replace('-PT0.', '-PT'),
    label: p.value === 0
      ? t.atTimeOfEvent
      : p.count
        ? t[p.labelKey as keyof typeof t]?.replace('{count}', String(p.count)) ?? `${p.count}`
        : '',
  })).filter(o => o.label)

  return (
    <div className="space-y-3">
      {alarms.length === 0 && (
        <p className="text-sm text-text-3 py-2">{t.noReminders}</p>
      )}

      {alarms.map((alarm, idx) => (
        <div key={alarm.uid} className="bg-surface-2 rounded-lg p-3 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">
              {t.reminders} {idx + 1}
            </span>
            <button
              onClick={() => removeAlarm(idx)}
              className="text-danger hover:bg-danger/10 p-1.5 rounded-md transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={t.reminders}
              options={triggerOptions}
              value={alarm.trigger}
              onChange={(e) => updateAlarm(idx, { trigger: e.target.value })}
            />
            <Select
              label={t.alarmDisplay}
              options={[
                { value: 'DISPLAY', label: t.alarmDisplay },
                { value: 'EMAIL', label: t.alarmEmail },
                { value: 'AUDIO', label: t.alarmAudio },
              ]}
              value={alarm.action}
              onChange={(e) => updateAlarm(idx, { action: e.target.value as EventAlarm['action'] })}
            />
          </div>

          {alarm.action === 'AUDIO' && (
            <Select
              label={t.alarmSound}
              options={APPLE_ALARM_SOUNDS.map((s) => ({ value: s, label: s }))}
              value={alarm.attachUri ?? 'Basso'}
              onChange={(e) => updateAlarm(idx, { attachUri: e.target.value })}
            />
          )}

          <Toggle
            label={t.defaultAlarm}
            checked={alarm.isDefault}
            onChange={(checked) => updateAlarm(idx, { isDefault: checked })}
          />
        </div>
      ))}

      <Button variant="ghost" size="sm" onClick={addAlarm}>
        <Plus size={16} /> {t.addReminder}
      </Button>
    </div>
  )
}
