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
        <span className="text-sm text-text">{label}</span>
        {description && <span className="text-xs text-text-3 mt-0.5">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-surface-3',
          'focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none',
        )}
      >
        <span
          className={cn(
            'inline-block h-[23px] w-[23px] rounded-full bg-white shadow-sm transition-transform duration-200 mt-[2px]',
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
          )}
        />
      </button>
    </label>
  )
}
