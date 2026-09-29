import { Link } from 'react-router-dom'
import { LOCALES, LOCALE_NAMES, useI18n, useT } from '@/i18n'
import { Ornament } from '@/components/Ornament'
import { useSettings, type EffectsLevel } from '@/store/useSettings'
import { playSound, unlockAudio } from '@/audio'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gold-400">{title}</h2>
      <div className="mt-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">{children}</div>
    </section>
  )
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  const t = useT()
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold text-steppe-50">{label}</div>
        {hint && <p className="mt-0.5 text-xs text-steppe-300">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`min-h-[44px] shrink-0 rounded-full px-5 text-sm font-bold transition-colors ${
          value ? 'bg-gold-400 text-night-900' : 'bg-white/10 text-steppe-300 ring-1 ring-white/15'
        }`}
      >
        {value ? t('settings.on') : t('settings.off')}
      </button>
    </div>
  )
}

export function Settings() {
  const t = useT()
  const locale = useI18n((s) => s.locale)
  const setLocale = useI18n((s) => s.setLocale)
  const s = useSettings()

  const setEffects = (level: EffectsLevel) => {
    s.set('effects', level)
    unlockAudio()
    playSound('tap')
  }

  return (
    <div className="min-h-full overflow-y-auto bg-night-900">
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center rounded-full bg-white/5 px-4 text-sm font-semibold text-steppe-50 ring-1 ring-white/10"
        >
          ← {t('rules.back')}
        </Link>

        <Ornament className="mx-auto my-5 h-3 w-40 text-gold-500/70" />
        <h1 className="text-center text-3xl font-extrabold text-steppe-50">{t('settings.title')}</h1>

        <Section title={t('settings.sound')}>
          <Toggle
            label={t('settings.sound')}
            value={s.sound}
            onChange={(v) => {
              s.set('sound', v)
              if (v) {
                unlockAudio()
                playSound('coin', { volume: 0.5 })
              }
            }}
          />
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm font-semibold text-steppe-50">
              <span>{t('settings.volume')}</span>
              <span className="font-mono text-xs text-steppe-300">{Math.round(s.volume * 100)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(s.volume * 100)}
              disabled={!s.sound}
              onChange={(e) => s.set('volume', Number(e.target.value) / 100)}
              onMouseUp={() => playSound('coin', { volume: 0.5 })}
              onTouchEnd={() => playSound('coin', { volume: 0.5 })}
              className="mt-2 h-11 w-full accent-gold-400 disabled:opacity-40"
              aria-label={t('settings.volume')}
            />
          </div>
        </Section>

        <Section title={t('settings.effects')}>
          <div className="flex gap-2">
            {(
              [
                ['full', 'settings.effects.full'],
                ['medium', 'settings.effects.medium'],
                ['low', 'settings.effects.low'],
              ] as const
            ).map(([level, key]) => (
              <button
                key={level}
                type="button"
                onClick={() => setEffects(level)}
                aria-pressed={s.effects === level}
                className={`min-h-[44px] flex-1 rounded-xl px-2 text-xs font-bold transition-colors sm:text-sm ${
                  s.effects === level
                    ? 'bg-gold-400 text-night-900'
                    : 'bg-white/10 text-steppe-100 ring-1 ring-white/15'
                }`}
              >
                {t(key)}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-steppe-300">{t('settings.effects.hint')}</p>

          <div className="mt-4 border-t border-white/10 pt-4">
            <Toggle
              label={t('settings.haptics')}
              hint={t('settings.haptics.hint')}
              value={s.haptics}
              onChange={(v) => s.set('haptics', v)}
            />
          </div>
        </Section>

        <Section title={t('settings.language')}>
          <div className="flex flex-col gap-2">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLocale(l)
                  playSound('tap')
                }}
                aria-pressed={locale === l}
                className={`min-h-[44px] rounded-xl px-4 text-left text-sm font-bold transition-colors ${
                  locale === l
                    ? 'bg-gold-400 text-night-900'
                    : 'bg-white/10 text-steppe-100 ring-1 ring-white/15'
                }`}
              >
                {LOCALE_NAMES[l]}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
