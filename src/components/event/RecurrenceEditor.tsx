import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import type { RecurrenceRule, WeekDay } from '@/types'
import { WEEK_DAYS } from '@/lib/constants'
import { useSettingsStore } from '@/stores/settings-store'
import { getTranslations } from '@/i18n'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface RecurrenceEditorProps {
  rule: RecurrenceRule | null
  exceptions: string[]
  onChange: (rule: RecurrenceRule | null) => void
  onExceptionsChange: (exceptions: string[]) => void
}

const DAY_LABELS: Record<WeekDay, string> = {
  SU: 'S', MO: 'M', TU: 'T', WE: 'W', TH: 'T', FR: 'F', SA: 'S',
}

export function RecurrenceEditor({ rule, exceptions, onChange, onExceptionsChange }: RecurrenceEditorProps) {
  const { settings } = useSettingsStore()
  const t = getTranslations(settings.language)
  const [endType, setEndType] = useState<'never' | 'count' | 'until'>(
    rule?.count ? 'count' : rule?.until ? 'until' : 'never'
  )

  const setFrequency = (freq: string) => {
    if (freq === 'none') {
      onChange(null)
      return
    }
    onChange({
      frequency: freq as RecurrenceRule['frequency'],
      interval: rule?.interval ?? 1,
      ...(rule?.count ? { count: rule.count } : {}),
      ...(rule?.until ? { until: rule.until } : {}),
      ...(freq === 'WEEKLY' ? { byDay: rule?.byDay ?? [] } : {}),
    })
  }

  const updateRule = (partial: Partial<RecurrenceRule>) => {
    if (!rule) return
    onChange({ ...rule, ...partial })
  }

  const toggleDay = (day: WeekDay) => {
    if (!rule) return
    const days = rule.byDay ?? []
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
    updateRule({ byDay: next })
  }

  return (
    <div className="space-y-4">
      <Select
        label={t.recurrence}
        options={[
          { value: 'none', label: t.noRepeat },
          { value: 'DAILY', label: t.daily },
          { value: 'WEEKLY', label: t.weekly },
          { value: 'MONTHLY', label: t.monthly },
          { value: 'YEARLY', label: t.yearly },
        ]}
        value={rule?.frequency ?? 'none'}
        onChange={(e) => setFrequency(e.target.value)}
      />

      {rule && (
        <div className="space-y-4 animate-slide-down">
          <div className="flex items-end gap-3">
            <Input
              label={t.repeatEvery}
              type="number"
              min={1}
              max={999}
              value={rule.interval}
              onChange={(e) => updateRule({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-20"
            />
            <span className="text-sm text-text-2 pb-2.5">
              {rule.frequency === 'DAILY' ? t.days : rule.frequency === 'WEEKLY' ? t.weeks : rule.frequency === 'MONTHLY' ? t.days : t.days}
            </span>
          </div>

          {rule.frequency === 'WEEKLY' && (
            <div>
              <label className="text-sm font-medium text-text-2 mb-2 block">{t.repeatOn}</label>
              <div className="flex gap-1.5">
                {WEEK_DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={cn(
                      'w-9 h-9 rounded-full text-sm font-medium transition-all duration-150',
                      rule.byDay?.includes(day)
                        ? 'bg-accent text-accent-text'
                        : 'bg-surface-2 text-text-2 hover:bg-surface-3',
                    )}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {rule.frequency === 'MONTHLY' && (
            <Input
              label={`${t.repeatOn} (${t.days})`}
              type="number"
              min={1}
              max={31}
              value={rule.byMonthDay?.[0] ?? 1}
              onChange={(e) => updateRule({ byMonthDay: [parseInt(e.target.value) || 1] })}
            />
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-2">{t.endsAfter}</label>
            <div className="flex gap-2">
              {(['never', 'count', 'until'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setEndType(type)
                    if (type === 'never') updateRule({ count: undefined, until: undefined })
                    if (type === 'count') updateRule({ count: 10, until: undefined })
                    if (type === 'until') updateRule({ count: undefined, until: new Date().toISOString() })
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    endType === type ? 'bg-accent text-accent-text' : 'bg-surface-2 text-text-2',
                  )}
                >
                  {type === 'never' ? t.endsNever : type === 'count' ? t.endsAfter : t.endsOn}
                </button>
              ))}
            </div>

            {endType === 'count' && (
              <div className="flex items-end gap-2 animate-fade-in">
                <Input
                  type="number"
                  min={1}
                  max={9999}
                  value={rule.count ?? 10}
                  onChange={(e) => updateRule({ count: parseInt(e.target.value) || 10 })}
                  className="w-24"
                />
                <span className="text-sm text-text-2 pb-2.5">{t.occurrences}</span>
              </div>
            )}

            {endType === 'until' && (
              <Input
                type="date"
                value={rule.until ? new Date(rule.until).toISOString().split('T')[0] : ''}
                onChange={(e) => updateRule({ until: new Date(e.target.value).toISOString() })}
                className="animate-fade-in"
              />
            )}
          </div>

          {/* Exceptions */}
          <div className="space-y-2">
            <Toggle
              label={t.exceptions}
              checked={exceptions.length > 0}
              onChange={() => {}}
              description={`${exceptions.length} ${t.exceptions.toLowerCase()}`}
            />
            {exceptions.map((ex, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="date"
                  value={new Date(ex).toISOString().split('T')[0]}
                  onChange={(e) => {
                    const next = [...exceptions]
                    next[idx] = new Date(e.target.value).toISOString()
                    onExceptionsChange(next)
                  }}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onExceptionsChange(exceptions.filter((_, i) => i !== idx))}
                  className="text-danger"
                >
                  ×
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onExceptionsChange([...exceptions, new Date().toISOString()])}
            >
              + {t.addException}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
