import { Link } from 'react-router-dom'
import { CHAPTERS, CAMPAIGN } from '@/levels'
import { useI18n, useT } from '@/i18n'
import { Ornament } from '@/components/Ornament'
import { Stars } from '@/components/Stars'
import { isUnlocked, loadProgress, nextUnfinished, totalStars } from '@/lib/progress'

export function Campaign() {
  const t = useT()
  const locale = useI18n((s) => s.locale)
  const progress = loadProgress()
  const resume = nextUnfinished(progress)

  return (
    <div className="min-h-full overflow-y-auto bg-night-900">
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center rounded-full bg-white/5 px-4 text-sm font-semibold text-steppe-50 ring-1 ring-white/10"
          >
            ← {t('rules.back')}
          </Link>
          <span className="text-sm font-bold text-gold-400">
            ★ {totalStars(progress)} / {CAMPAIGN.length * 3}
          </span>
        </div>

        <Ornament className="mx-auto my-5 h-3 w-40 text-gold-500/70" />
        <h1 className="text-center text-3xl font-extrabold text-steppe-50">{t('campaign.title')}</h1>

        <Link
          to={`/campaign/${resume.id}`}
          className="mt-5 flex min-h-[44px] items-center justify-center rounded-2xl bg-gold-400 p-4 font-bold text-night-900 transition-transform active:scale-[0.98]"
        >
          {t('campaign.continue')} · {resume.number}
        </Link>

        {CHAPTERS.map((chapter) => (
          <section key={chapter.id} className="mt-8">
            <h2 className="text-lg font-extrabold text-steppe-50">{chapter.title[locale]}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-steppe-300">
              {chapter.subtitle[locale]}
            </p>

            <ul className="mt-3 grid grid-cols-3 gap-2">
              {chapter.levels.map((level) => {
                const item = CAMPAIGN.find((l) => l.id === level.id)!
                const done = progress[level.id]
                const open = isUnlocked(level.id, progress)
                return (
                  <li key={level.id}>
                    {open ? (
                      <Link
                        to={`/campaign/${level.id}`}
                        className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/5 ring-1 ring-white/10 transition-transform hover:bg-white/10 active:scale-95"
                      >
                        <span className="text-lg font-extrabold text-steppe-50">{item.number}</span>
                        <Stars value={done ? done.stars : 0} size={13} />
                      </Link>
                    ) : (
                      <div
                        title={t('campaign.locked')}
                        aria-label={t('campaign.locked')}
                        className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl bg-black/30 text-steppe-300/50 ring-1 ring-white/5"
                      >
                        <span className="text-lg">🔒</span>
                        <span className="text-xs font-bold">{item.number}</span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
