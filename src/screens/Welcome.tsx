import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ornament } from '@/components/Ornament'
import { LOCALES, LOCALE_NAMES, useI18n, useT, type Locale } from '@/i18n'
import { AVATARS, AVATAR_EMOJI } from '@/net/profile'
import { markOnboarded } from '@/lib/progress'
import { notifyOnboarded } from '@/App'
import { useAuthStore } from '@/store/useAuthStore'

/**
 * Знакомство при первом запуске: имя, аватар и язык.
 *
 * Почта и пароль здесь НЕ нужны — играть можно сразу. Смысл экрана в том,
 * чтобы в таблицах лидеров и в матчах стояли живые имена, а не «Қонақ 35A6»:
 * из-за них было непонятно, кто есть кто. Сохранить прогресс на другое
 * устройство по-прежнему можно позже, в профиле.
 */
export function Welcome() {
  const t = useT()
  const navigate = useNavigate()
  const locale = useI18n((s) => s.locale)
  const setLocale = useI18n((s) => s.setLocale)
  const save = useAuthStore((s) => s.save)

  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<string>(AVATARS[0])
  const [busy, setBusy] = useState(false)

  const clean = name.trim()
  const valid = clean.length >= 2 && clean.length <= 24

  const go = async () => {
    if (!valid || busy) return
    setBusy(true)
    // Профиль может не сохраниться (нет сети) — это не повод не пускать
    // в игру: имя и аватар всё равно останутся локально в отметке.
    await save({ username: clean, avatar, locale })
    markOnboarded(clean, avatar)
    notifyOnboarded()
    setBusy(false)
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-8">
      <Ornament className="mx-auto mb-4 h-3 w-48 text-gold-500/70" />
      <h1 className="text-center text-3xl font-extrabold text-steppe-50">{t('welcome.title')}</h1>
      <p className="mt-2 text-center text-sm text-steppe-300">{t('welcome.subtitle')}</p>

      {/* ── Язык ──────────────────────────────────────────────────────── */}
      <div className="mt-7">
        <p className="text-xs font-bold uppercase tracking-widest text-gold-400">
          {t('welcome.language')}
        </p>
        <div className="mt-2 flex gap-2">
          {LOCALES.map((l: Locale) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-pressed={locale === l}
              className={`min-h-[48px] flex-1 rounded-2xl text-sm font-bold ${
                locale === l
                  ? 'bg-gold-400 text-night-900'
                  : 'bg-white/10 text-steppe-100 ring-1 ring-white/15'
              }`}
            >
              {LOCALE_NAMES[l]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Имя ───────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-widest text-gold-400">
          {t('welcome.name')}
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          placeholder={t('welcome.namePlaceholder')}
          autoFocus
          className="mt-2 min-h-[52px] w-full rounded-2xl bg-white/10 px-4 text-lg text-steppe-50 ring-1 ring-white/15 placeholder:text-steppe-400"
        />
        {name.length > 0 && !valid && (
          <p className="mt-2 text-xs text-sky-450">{t('welcome.nameHint')}</p>
        )}
      </div>

      {/* ── Аватар ────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-widest text-gold-400">
          {t('welcome.avatar')}
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAvatar(a)}
              aria-pressed={avatar === a}
              aria-label={a}
              className={`flex min-h-[56px] items-center justify-center rounded-2xl text-2xl ${
                avatar === a ? 'bg-gold-400 ring-2 ring-gold-400' : 'bg-black/40 ring-1 ring-white/15'
              }`}
            >
              {AVATAR_EMOJI[a]}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!valid || busy}
        onClick={() => void go()}
        className="mt-8 min-h-[56px] w-full rounded-2xl bg-gold-400 text-lg font-bold text-night-900 transition-transform active:scale-95 disabled:opacity-40"
      >
        {busy ? t('common.loading') : t('welcome.start')}
      </button>

      <p className="mt-4 text-center text-xs leading-relaxed text-steppe-400">
        {t('welcome.note')}
      </p>
    </div>
  )
}
