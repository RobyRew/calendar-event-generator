import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'

interface TimePickerProps {
  value: string // HH:mm format
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
  minuteStep?: number
}

export function TimePicker({ value, onChange, label, disabled, minuteStep }: TimePickerProps) {
  const { settings } = useSettingsStore()
  const is24h = settings.timeFormat === '24h'
  const step = minuteStep ?? settings.snapMinutesTo

  const [rawH, rawM] = value.split(':').map(Number) as [number, number]

  const displayHour = is24h ? rawH : rawH === 0 ? 12 : rawH > 12 ? rawH - 12 : rawH
  const period = rawH >= 12 ? 'PM' : 'AM'

  const hourOptions = useMemo(() => {
    if (is24h) return Array.from({ length: 24 }, (_, i) => i)
    return Array.from({ length: 12 }, (_, i) => i === 0 ? 12 : i)
  }, [is24h])

  const minuteOptions = useMemo(() => {
    const opts: number[] = []
    for (let i = 0; i < 60; i += step) opts.push(i)
    return opts
  }, [step])

  const handleHourChange = (h: number) => {
    let hour24 = h
    if (!is24h) {
      if (period === 'AM') hour24 = h === 12 ? 0 : h
      else hour24 = h === 12 ? 12 : h + 12
    }
    onChange(`${String(hour24).padStart(2, '0')}:${String(rawM).padStart(2, '0')}`)
  }

  const handleMinuteChange = (m: number) => {
    onChange(`${String(rawH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }

  const handlePeriodChange = (newPeriod: string) => {
    let hour24 = rawH
    if (newPeriod === 'AM' && rawH >= 12) hour24 = rawH === 12 ? 0 : rawH - 12
    if (newPeriod === 'PM' && rawH < 12) hour24 = rawH === 0 ? 12 : rawH + 12
    onChange(`${String(hour24).padStart(2, '0')}:${String(rawM).padStart(2, '0')}`)
  }

  const selectClass = cn(
    'h-10 rounded-lg border border-border bg-surface px-2 text-sm text-text text-center',
    'appearance-none transition-colors duration-150',
    'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  )

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-text-2">{label}</label>}
      <div className="flex items-center gap-1">
        <select
          value={displayHour}
          onChange={(e) => handleHourChange(Number(e.target.value))}
          disabled={disabled}
          className={cn(selectClass, 'w-16')}
          aria-label="Hour"
        >
          {hourOptions.map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, '0')}
            </option>
          ))}
        </select>
        <span className="text-text-3 font-semibold text-lg">:</span>
        <select
          value={rawM}
          onChange={(e) => handleMinuteChange(Number(e.target.value))}
          disabled={disabled}
          className={cn(selectClass, 'w-16')}
          aria-label="Minute"
        >
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, '0')}
            </option>
          ))}
        </select>
        {!is24h && (
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            disabled={disabled}
            className={cn(selectClass, 'w-18')}
            aria-label="AM/PM"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        )}
      </div>
    </div>
  )
}
