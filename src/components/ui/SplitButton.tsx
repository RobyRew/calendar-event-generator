/**
 * Split Button Component
 * A button with a primary action and a dropdown for secondary actions
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib';

interface SplitButtonOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface SplitButtonProps {
  primaryLabel: string;
  primaryIcon?: React.ReactNode;
  primaryAction: () => void;
  options: SplitButtonOption[];
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

const variantStyles = {
  primary: {
    button: 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600',
    divider: 'border-primary-500 dark:border-primary-400',
    dropdown: 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700',
  },
  secondary: {
    button: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600',
    divider: 'border-gray-300 dark:border-slate-500',
    dropdown: 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700',
  },
  outline: {
    button: 'border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700',
    divider: 'border-gray-300 dark:border-slate-600',
    dropdown: 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700',
  },
};

const sizeStyles = {
  sm: {
    button: 'px-2 py-1 text-xs',
    icon: 'w-3 h-3',
    dropdown: 'text-xs',
  },
  md: {
    button: 'px-3 py-1.5 text-sm',
    icon: 'w-4 h-4',
    dropdown: 'text-sm',
  },
  lg: {
    button: 'px-4 py-2 text-base',
    icon: 'w-5 h-5',
    dropdown: 'text-base',
  },
};

export function SplitButton({
  primaryLabel,
  primaryIcon,
  primaryAction,
  options,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className,
}: SplitButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      {/* Primary Button */}
      <button
        type="button"
        onClick={primaryAction}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 font-medium rounded-l-md transition-colors',
          styles.button,
          sizes.button,
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {primaryIcon && <span className={sizes.icon}>{primaryIcon}</span>}
        {primaryLabel}
      </button>

      {/* Divider */}
      <div className={cn('w-px', styles.divider)} />

      {/* Dropdown Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center rounded-r-md transition-colors',
          styles.button,
          size === 'sm' ? 'px-1 py-1' : size === 'md' ? 'px-1.5 py-1.5' : 'px-2 py-2',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <ChevronDown className={cn(sizes.icon, 'transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full right-0 mt-1 min-w-[180px] rounded-md shadow-lg z-50',
            styles.dropdown,
            sizes.dropdown
          )}
        >
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  option.onClick();
                  setIsOpen(false);
                }}
                disabled={option.disabled}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left',
                  'text-gray-700 dark:text-slate-200',
                  'hover:bg-gray-100 dark:hover:bg-slate-700',
                  'transition-colors',
                  option.disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {option.icon && <span className={sizes.icon}>{option.icon}</span>}
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
