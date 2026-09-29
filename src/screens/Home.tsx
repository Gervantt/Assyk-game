import { Link } from 'react-router-dom'
import { useT } from '@/i18n'
import { LocaleSwitch } from '@/components/LocaleSwitch'
import { Ornament } from '@/components/Ornament'
import { loadBest } from '@/lib/storage'
import { loadProgress, nextUnfinished, totalStars, tutorialDone } from '@/lib/progress'
import { CAMPAIGN } from '@/levels'
import { Stars } from '@/components/Stars'
import { BackendBanner } from '@/components/BackendBanner'
import { percent } from '@/lib/format'
import type { DictKey } from '@/i18n'

function ModeCard({ to, title, desc, primary = false }: {
  to: string
  title: string
  desc: string
  primary?: boolean
}) {
  return (
    <Link
      to={to}
      className={`group flex min-h-[44px] flex-col gap-1 rounded-3xl p-5 ring-1 transition-transform active:scale-[0.98] ${
        primary
          ? 'bg-gold-400 text-night-900 ring-gold-500'
          : 'bg-white/5 text-steppe-50 ring-white/10 hover:bg-white/10'
      }`}
    >
      <span className="text-xl font-extrabold">{title}</span>
      <span className={primary ? 'text-sm text-night-900/75' : 'text-sm text-steppe-300'}>
        {desc}
      </span>
    </Link>
  )
}

export function Home() {
  const t = useT()
  const best = loadBest('training')
  const progress = loadProgress()
  const stars = totalStars(progress)
  const fresh = !tutorialDone() && stars === 0

  // новичку первым предлагаем обучение, дальше — кампанию
  const modes: Array<{ to: string; title: DictKey; desc: DictKey; primary?: boolean }> = fresh
    ? [
        { to: '/tutorial', title: 'mode.tutorial', desc: 'mode.tutorial.desc', primary: true },
        { to: '/campaign', title: 'mode.campaign', desc: 'mode.campaign.desc' },
        { to: '/play/training', title: 'mode.training', desc: 'mode.training.desc' },
        { to: '/daily', title: 'mode.daily', desc: 'mode.daily.desc' },
        { to: '/play/hotseat', title: 'mode.hotseat', desc: 'mode.hotseat.desc' },
      ]
    : [
        { to: `/campaign/${nextUnfinished(progress).id}`, title: 'mode.campaign', desc: 'mode.campaign.desc', primary: true },
        { to: '/daily', title: 'mode.daily', desc: 'mode.daily.desc' },
        { to: '/play/training', title: 'mode.training', desc: 'mode.training.desc' },
        { to: '/play/hotseat', title: 'mode.hotseat', desc: 'mode.hotseat.desc' },
        { to: '/tutorial', title: 'mode.tutorial', desc: 'mode.tutorial.desc' },
      ]

  return (
    <div className="relative min-h-full overflow-y-auto bg-night-900">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(120% 70% at 50% -10%, #1d2a3d 0%, #0d1017 60%), radial-gradient(50% 40% at 80% 100%, #2a1f12 0%, transparent 70%)',
        }}
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-5 py-8">
        <div className="flex justify-end">
          <LocaleSwitch />
        </div>

        <header className="text-center">
          <Ornament className="mx-auto mb-4 h-3 w-48 text-gold-500/70" />
          <h1 className="text-4xl font-extrabold tracking-tight text-steppe-50">{t('app.title')}</h1>
          <p className="mt-2 text-lg font-semibold text-gold-400">{t('app.tagline')}</p>
          <p className="mt-1 text-sm text-steppe-300">{t('app.subtitle')}</p>
        </header>

        <BackendBanner />

        <nav className="flex flex-col gap-3">
          {modes.map((m) => (
            <ModeCard
              key={m.to}
              to={m.to}
              title={t(m.title)}
              desc={t(m.desc)}
              primary={m.primary}
            />
          ))}
          <div className="flex gap-3">
            {(
              [
                { to: '/profile', key: 'mode.profile' },
                { to: '/rules', key: 'mode.rules' },
                { to: '/settings', key: 'mode.settings' },
              ] as const
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-3xl bg-transparent p-4 text-sm font-semibold text-steppe-300 ring-1 ring-white/10 hover:bg-white/5"
              >
                {t(item.key)}
              </Link>
            ))}
          </div>
        </nav>

        <div className="flex flex-col items-center gap-2 text-center text-xs text-steppe-300">
          {stars > 0 && (
            <Link to="/campaign" className="flex items-center gap-2 hover:text-steppe-50">
              <Stars value={3} size={13} />
              <span className="font-bold text-steppe-50">
                {stars} / {CAMPAIGN.length * 3}
              </span>
              <span>{t('campaign.stars')}</span>
            </Link>
          )}
          {best && (
            <p>
              {t('hud.best')}: <span className="font-bold text-steppe-50">{best.score}</span> ·{' '}
              {percent(best.accuracy)}
            </p>
          )}
        </div>

        <footer className="mt-auto pt-6 text-center text-[11px] text-steppe-300/70">
          Narxoz Incubator 2026 · {t('aim.hintKeyboard')}
        </footer>
      </div>
    </div>
  )
}
