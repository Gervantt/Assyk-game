import { Link, useNavigate } from 'react-router-dom'
import { dominantHint, type HintKey } from '@/game/rules'
import type { MatchState } from '@/game/rules'
import { nextLevel, type CampaignLevel } from '@/levels'
import { useT } from '@/i18n'
import { isUnlocked, loadProgress } from '@/lib/progress'
import { useGameStore } from '@/store/useGameStore'
import { Ornament } from './Ornament'
import { Stars } from './Stars'

/** Итоги уровня кампании: звёзды или совет, что поправить. */
export function LevelResult({ match, level }: { match: MatchState; level: CampaignLevel }) {
  const t = useT()
  const navigate = useNavigate()
  const stars = useGameStore((s) => s.levelStars)
  const newRecord = useGameStore((s) => s.newRecord)
  const restart = useGameStore((s) => s.restart)

  const player = match.players[0]!
  const knocked = match.history.reduce((n, h) => n + h.knockedOut.length, 0)
  const won = stars !== null

  const hints = match.history.map((h) => h.hint)
  const hint: HintKey | null = won ? null : dominantHint(hints)

  const after = nextLevel(level.id)
  const canGoNext = won && after && isUnlocked(after.id, loadProgress())

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-night-900/88 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-night-800 p-6 ring-1 ring-white/10">
        <Ornament className="mx-auto mb-3 h-3 w-40 text-gold-500/70" />
        <h2 className="text-center text-2xl font-extrabold text-steppe-50">
          {won ? t('level.win') : t('level.lose')}
        </h2>

        {won && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <Stars value={stars} size={34} />
            {newRecord && (
              <span className="text-xs font-bold uppercase tracking-widest text-gold-400">
                {t('level.record')}
              </span>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-center gap-6 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-steppe-300">
              {t('level.knocked')}
            </div>
            <div className="text-xl font-bold text-steppe-50">
              {knocked} / {level.goal}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-steppe-300">
              {t('level.used')}
            </div>
            <div className="text-xl font-bold text-steppe-50">
              {player.throwsUsed} / {level.throws}
            </div>
          </div>
        </div>

        {hint && (
          <div className="mt-5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-sky-450">
              {t('hint.title')}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-steppe-100">{t(hint)}</p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {canGoNext ? (
            <button
              type="button"
              onClick={() => navigate(`/campaign/${after.id}`)}
              className="min-h-[44px] flex-1 rounded-2xl bg-gold-400 font-bold text-night-900 transition-transform active:scale-95"
            >
              {t('level.next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={restart}
              className="min-h-[44px] flex-1 rounded-2xl bg-gold-400 font-bold text-night-900 transition-transform active:scale-95"
            >
              {t('level.retry')}
            </button>
          )}
          <Link
            to="/campaign"
            className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-white/10 font-bold text-steppe-50 ring-1 ring-white/15 transition-transform active:scale-95"
          >
            {t('level.map')}
          </Link>
        </div>

        {won && (
          <button
            type="button"
            onClick={restart}
            className="mt-3 min-h-[44px] w-full rounded-2xl text-sm font-semibold text-steppe-300 hover:text-steppe-50"
          >
            {t('level.retry')}
          </button>
        )}
      </div>
    </div>
  )
}
