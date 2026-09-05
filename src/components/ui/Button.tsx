import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

// Appearance comes from .rw-btn in @robyrew/ui, so this file no longer carries
// its own fill/hover/press values. `ghost` and `accent` were the same control —
// a transparent button whose label is the only mark — and both map to
// .rw-btn--plain; `accent` keeps its name so callers do not have to change.
const variantClasses: Record<Variant, string> = {
  primary: 'rw-btn--primary',
  secondary: '',
  ghost: 'rw-btn--plain !text-ink-2',
  danger: 'rw-btn--danger',
  accent: 'rw-btn--plain',
}

const sizeClasses: Record<Size, string> = {
  sm: 'rw-btn--sm h-8',
  md: 'h-10',
  lg: 'rw-btn--lg h-12',
  icon: 'h-10 w-10 !px-0',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'rw-btn',
        'disabled:opacity-40 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
