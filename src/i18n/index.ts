import { create } from 'zustand'
import { dict, LOCALES, type DictKey, type Locale } from './locales'

const STORAGE_KEY = 'asyq.locale'

function detect(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale
  } catch {
    /* приватный режим — просто идём дальше */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'kk'
  if (nav.startsWith('kk')) return 'kk'
  if (nav.startsWith('ru')) return 'ru'
  if (nav.startsWith('en')) return 'en'
  return 'kk'
}

interface I18nStore {
  locale: Locale
  setLocale: (l: Locale) => void
}

export const useI18n = create<I18nStore>((set) => ({
  locale: detect(),
  setLocale: (locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      /* игнорируем */
    }
    document.documentElement.lang = locale
    set({ locale })
  },
}))

/** Перевод с подстановкой {name}. */
export function translate(locale: Locale, key: DictKey, vars?: Record<string, string>): string {
  const entry = dict[key]
  let s: string = entry ? entry[locale] : key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v)
  return s
}

/** Хук перевода для компонентов. */
export function useT() {
  const locale = useI18n((s) => s.locale)
  return (key: DictKey, vars?: Record<string, string>) => translate(locale, key, vars)
}

export { LOCALES, LOCALE_NAMES } from './locales'
export type { Locale, DictKey } from './locales'
