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
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variant === 'filled'
          ? 'text-white'
          : 'border',
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
