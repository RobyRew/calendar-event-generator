/**
 * Theme Selector Component
 * Dropdown to change the app theme (similar to LanguageSelector)
 */

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Sun, Moon, Smartphone, Layers, Droplets } from 'lucide-react';
import { ThemeId, THEMES, getThemeConfig } from '@/styles/themes';
import { useI18n } from '@/context/I18nContext';

interface ThemeSelectorProps {
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
  className?: string;
  compact?: boolean;
}

// Icons for each theme
const THEME_ICONS: Record<ThemeId, React.ReactNode> = {
  light: <Sun className="w-4 h-4" />,
  dark: <Moon className="w-4 h-4" />,
  oled: <Smartphone className="w-4 h-4" />,
  neumorphic: <Layers className="w-4 h-4" />,
  glass: <Droplets className="w-4 h-4" />,
};

export function ThemeSelector({ theme, onChangeTheme, className = '', compact = false }: ThemeSelectorProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentTheme = getThemeConfig(theme);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (themeId: ThemeId) => {
    onChangeTheme(themeId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 rounded-lg transition-all
          bg-[rgb(var(--card))] border border-[rgb(var(--border))]
          hover:border-[rgb(var(--ring))]
          ${compact ? 'p-2' : 'px-3 py-2'}
        `}
        aria-label={t.theme}
      >
        <span className="text-[rgb(var(--foreground))]">
          {THEME_ICONS[theme]}
        </span>
        {!compact && (
          <>
            <span className="text-sm font-medium text-[rgb(var(--foreground))]">
              {currentTheme.name}
            </span>
            <ChevronDown className={`w-4 h-4 text-[rgb(var(--muted-foreground))] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-[rgb(var(--card))] border border-[rgb(var(--border))] rounded-lg shadow-lg py-1 z-50 animate-scale-in">
          <div className="px-3 py-2 border-b border-[rgb(var(--border))]">
            <span className="text-xs font-medium text-[rgb(var(--muted-foreground))] uppercase tracking-wider">
              {t.theme}
            </span>
          </div>
          {THEMES.map(themeOption => (
            <button
              key={themeOption.id}
              onClick={() => handleSelect(themeOption.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors
                ${theme === themeOption.id 
                  ? 'bg-[rgb(var(--accent))] text-[rgb(var(--foreground))]' 
                  : 'text-[rgb(var(--foreground))] hover:bg-[rgb(var(--accent))]'
                }
              `}
            >
              <span className="text-[rgb(var(--muted-foreground))]">
                {THEME_ICONS[themeOption.id]}
              </span>
              <div className="flex-1 text-left">
                <span className="block font-medium">{themeOption.name}</span>
                <span className="block text-xs text-[rgb(var(--muted-foreground))]">
                  {themeOption.description}
                </span>
              </div>
              {theme === themeOption.id && (
                <Check className="w-4 h-4 text-[rgb(var(--primary))]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
