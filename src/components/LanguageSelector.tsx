/**
 * Language Selector Component
 * Dropdown to change the app language
 */

import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/context/I18nContext';
import { Language } from '@/i18n';
import { Globe, ChevronDown, Check } from 'lucide-react';

interface LanguageSelectorProps {
  className?: string;
  compact?: boolean;
}

export function LanguageSelector({ className = '', compact = false }: LanguageSelectorProps) {
  const { language, setLanguage, languageNames, availableLanguages, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
    setIsOpen(false);
  };

  // Get flag emoji for language
  const getFlag = (lang: Language): string => {
    const flags: Record<Language, string> = {
      en: '🇬🇧',
      es: '🇪🇸',
      de: '🇩🇪',
      fr: '🇫🇷',
      it: '🇮🇹',
      pt: '🇵🇹',
      zh: '🇨🇳',
      ja: '🇯🇵',
      ko: '🇰🇷',
      ru: '🇷🇺',
    };
    return flags[lang] || '🌐';
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
        aria-label={t.language}
      >
        {compact ? (
          <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-[rgb(var(--foreground))]" />
        ) : (
          <>
            <span className="text-lg">{getFlag(language)}</span>
            <span className="text-sm font-medium text-[rgb(var(--foreground))]">
              {languageNames[language]}
            </span>
            <ChevronDown className={`w-4 h-4 text-[rgb(var(--muted-foreground))] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[rgb(var(--card))] border border-[rgb(var(--border))] rounded-lg shadow-lg py-1 z-50 animate-scale-in">
          <div className="px-3 py-2 border-b border-[rgb(var(--border))]">
            <span className="text-xs font-medium text-[rgb(var(--muted-foreground))] uppercase tracking-wider">
              {t.language}
            </span>
          </div>
          {availableLanguages.map(lang => (
            <button
              key={lang}
              onClick={() => handleSelect(lang)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors
                ${language === lang 
                  ? 'bg-[rgb(var(--accent))] text-[rgb(var(--foreground))]' 
                  : 'text-[rgb(var(--foreground))] hover:bg-[rgb(var(--accent))]'
                }
              `}
            >
              <span className="text-lg">{getFlag(lang)}</span>
              <span className="flex-1 text-left">{languageNames[lang]}</span>
              {language === lang && (
                <Check className="w-4 h-4 text-[rgb(var(--primary))]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
