import { cn } from '@/lib/utils'
import { EVENT_COLORS } from '@/lib/constants'
import { Check } from 'lucide-react'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label?: string
  colors?: readonly string[]
}

export function ColorPicker({ value, onChange, label, colors = EVENT_COLORS }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-text-2">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'w-7 h-7 rounded-full transition-transform duration-150 flex items-center justify-center',
              'hover:scale-110 active:scale-95',
              value === color && 'ring-2 ring-offset-2 ring-offset-surface',
            )}
            style={{ backgroundColor: color, '--tw-ring-color': color } as React.CSSProperties}
            aria-label={color}
          >
            {value === color && <Check size={14} className="text-white" strokeWidth={3} />}
          </button>
        ))}
      </div>
    </div>
  )
}
