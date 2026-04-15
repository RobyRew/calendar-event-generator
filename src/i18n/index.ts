import { en, es, ro } from './locales'
import type { Translations } from './types'
import type { Language } from '@/types'

export type { Translations }

const locales: Record<Language, Translations> = { en, es, ro }

export function getTranslations(lang: Language): Translations {
  return locales[lang] ?? en
}

export function t(translations: Translations, key: keyof Translations, vars?: Record<string, string | number>): string {
  let text = translations[key]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}
