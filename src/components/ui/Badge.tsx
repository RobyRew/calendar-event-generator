import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  color?: string
  variant?: 'filled' | 'outline'
  className?: string
}

export function Badge({ children, color, variant = 'filled', className }: BadgeProps) {
  return (
    <span
      className={cn(
        // .rw-badge is the label shape; a per-event colour still arrives as an
        // inline style, since that palette is user-chosen and not a token.
        'rw-badge !rounded-full',
        variant === 'filled' ? '!text-white' : 'border !bg-transparent',
        className,
      )}
      style={
        color
          ? variant === 'filled'
            ? { backgroundColor: color }
            : { borderColor: color, color }
          : undefined
      }
    >
      {children}
    </span>
  )
}
