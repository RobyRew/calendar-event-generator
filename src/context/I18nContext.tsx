/**
 * Internationalization Context
 * Provides language state and translations throughout the app
 */

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Language, Translations, translations, getBrowserLanguage, languageNames } from '@/i18n';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  languageNames: Record<Language, string>;
  availableLanguages: Language[];
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'calendar-app-language';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Try to get from localStorage first
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && translations[stored]) {
      return stored;
    }
    // Fall back to browser language
    return getBrowserLanguage();
  });

  // Save language preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    // Update document lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    if (translations[lang]) {
      setLanguageState(lang);
    }
  }, []);

  const t = translations[language];
  const availableLanguages: Language[] = ['en', 'es', 'de', 'fr'];

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, languageNames, availableLanguages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
