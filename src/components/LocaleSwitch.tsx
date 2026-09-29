import { LOCALES, LOCALE_NAMES, useI18n } from '@/i18n'

export function LocaleSwitch({ compact = false }: { compact?: boolean }) {
  const locale = useI18n((s) => s.locale)
  const setLocale = useI18n((s) => s.setLocale)

  return (
    <div className="flex rounded-full bg-black/40 p-0.5 ring-1 ring-white/15">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`min-h-[34px] rounded-full px-3 text-xs font-semibold transition-colors ${
            locale === l ? 'bg-gold-400 text-night-900' : 'text-steppe-100 hover:bg-white/10'
          }`}
        >
          {compact ? l.toUpperCase() : LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  )
}
