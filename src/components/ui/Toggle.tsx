import { cn } from '@/lib/utils'

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  description?: string
}

export function Toggle({ label, checked, onChange, disabled, description }: ToggleProps) {
  return (
    <label
      className={cn(
        'flex items-center justify-between cursor-pointer select-none py-1',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div className="flex flex-col">
        <span className="text-sm text-ink">{label}</span>
        {description && <span className="text-xs text-ink-3 mt-0.5">{description}</span>}
      </div>
      {/* .rw-switch draws the knob as a ::after, so there is no child element
          here; the class handles both a checkbox and this role="switch" shape. */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="rw-switch"
      />
    </label>
  )
}
