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
  const { language, setLanguage, languageNames, availableLanguages } = useI18n();
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
          flex items-center gap-2 rounded-lg transition-colors
          ${compact 
            ? 'p-2 hover:bg-gray-100 dark:hover:bg-slate-700' 
            : 'px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-primary-500'
          }
        `}
        aria-label="Select language"
      >
        {compact ? (
          <Globe className="w-5 h-5 text-gray-600 dark:text-slate-400" />
        ) : (
          <>
            <span className="text-lg">{getFlag(language)}</span>
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {languageNames[language]}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
          {availableLanguages.map(lang => (
            <button
              key={lang}
              onClick={() => handleSelect(lang)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors
                ${language === lang 
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                }
              `}
            >
              <span className="text-lg">{getFlag(lang)}</span>
              <span className="flex-1 text-left">{languageNames[lang]}</span>
              {language === lang && (
                <Check className="w-4 h-4 text-primary-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
