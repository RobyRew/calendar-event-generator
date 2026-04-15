import { cn } from '@/lib/utils'

interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
}

export function Checkbox({ label, checked, onChange, disabled, id }: CheckboxProps) {
  const checkboxId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        'flex items-center gap-3 cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div className="relative flex items-center">
        <input
          type="checkbox"
          id={checkboxId}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          className={cn(
            'w-5 h-5 rounded-md border-2 transition-all duration-150',
            'peer-checked:bg-accent peer-checked:border-accent',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/20',
            !checked && 'border-border bg-surface',
          )}
        >
          {checked && (
            <svg className="w-full h-full text-accent-text p-0.5" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 8.5L6.5 11.5L12.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-text">{label}</span>
    </label>
  )
}
