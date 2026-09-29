import { Link } from 'react-router-dom'
import { accuracy, type MatchState } from '@/game/rules'
import { useT } from '@/i18n'
import { percent } from '@/lib/format'
import { loadBest } from '@/lib/storage'
import { useGameStore } from '@/store/useGameStore'
import { Ornament } from './Ornament'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/10 py-2">
      <span className="text-sm text-steppe-300">{label}</span>
      <span className="text-lg font-bold text-steppe-50">{value}</span>
    </div>
  )
}

export function ResultsOverlay({ match }: { match: MatchState }) {
  const t = useT()
  const restart = useGameStore((s) => s.restart)
  const newRecord = useGameStore((s) => s.newRecord)
  const best = loadBest(match.mode)

  const hotseat = match.players.length > 1
  const winner = match.winner !== null ? match.players[match.winner] : null
  const me = match.players[0]!

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-night-900/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-night-800 p-6 ring-1 ring-white/10">
        <Ornament className="mx-auto mb-3 h-3 w-40 text-gold-500/70" />
        <h2 className="text-center text-2xl font-extrabold text-steppe-50">{t('result.title')}</h2>

        {hotseat && (
          <p className="mt-2 text-center text-lg font-bold text-gold-400">
            {winner ? t('result.winner', { name: winner.name }) : t('result.draw')}
          </p>
        )}
        {!hotseat && newRecord && (
          <p className="mt-2 text-center text-sm font-bold uppercase tracking-widest text-gold-400">
            {t('result.newBest')}
          </p>
        )}

        <div className="mt-4">
          {hotseat ? (
            match.players.map((p) => (
              <Row
                key={p.index}
                label={p.name}
                value={`${p.score} · ${percent(accuracy(p))}`}
              />
            ))
          ) : (
            <>
              <Row label={t('result.score')} value={String(me.score)} />
              <Row label={t('result.accuracy')} value={percent(accuracy(me))} />
              <Row label={t('result.bestThrow')} value={String(me.bestThrow)} />
              <Row label={t('result.streak')} value={String(me.bestStreak)} />
              <Row label={t('result.penalties')} value={String(me.penalties)} />
              {best && (
                <Row label={t('hud.best')} value={`${best.score} · ${percent(best.accuracy)}`} />
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={restart}
            className="min-h-[44px] flex-1 rounded-2xl bg-gold-400 font-bold text-night-900 transition-transform active:scale-95"
          >
            {t('result.again')}
          </button>
          <Link
            to="/"
            className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-white/10 font-bold text-steppe-50 ring-1 ring-white/15 transition-transform active:scale-95"
          >
            {t('result.home')}
          </Link>
        </div>
      </div>
    </div>
  )
}
