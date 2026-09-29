import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { knockedOutCount } from '@/game/rules'
import { dailyLevel, todayISO } from '@/levels/daily'
import { GameView } from '@/game/GameView'
import { PowerBar } from '@/components/PowerBar'
import { Ornament } from '@/components/Ornament'
import { BackendBanner } from '@/components/BackendBanner'
import { AVATAR_EMOJI } from '@/net/profile'
import { fetchLeaderboard, fetchMyDaily, loadLocalDaily, type LocalDaily } from '@/net/daily'
import type { LeaderboardRow } from '@/net/types'
import { useT } from '@/i18n'
import type { DictKey } from '@/i18n'
import { percent } from '@/lib/format'
import { usePopupStore } from '@/game/fx/popupStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useGameStore } from '@/store/useGameStore'

const MODIFIER_KEY: Record<string, DictKey> = {
  plain: 'daily.modifier.plain',
  stones: 'daily.modifier.stones',
  wind: 'daily.modifier.wind',
  movers: 'daily.modifier.movers',
}

export function Daily() {
  const t = useT()
  const date = todayISO()
  const level = dailyLevel(date)

  const userId = useAuthStore((s) => s.userId)
  const status = useAuthStore((s) => s.status)
  const match = useGameStore((s) => s.match)
  const phase = useGameStore((s) => s.phase)
  const startDaily = useGameStore((s) => s.startDaily)
  const leave = useGameStore((s) => s.leave)

  const [playing, setPlaying] = useState(false)
  const [mine, setMine] = useState<LocalDaily | null>(loadLocalDaily())
  const [board, setBoard] = useState<LeaderboardRow[]>([])

  const alreadyPlayed = mine?.date === date

  const refresh = useCallback(async () => {
    setBoard(await fetchLeaderboard(date, 50))
    if (userId && status === 'ready') {
      const row = await fetchMyDaily(userId, date)
      if (row) setMine({ date: row.date, score: row.score, throws: row.throws, accuracy: row.accuracy })
    }
  }, [date, userId, status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    return () => {
      leave()
      usePopupStore.getState().clear()
    }
  }, [leave])

  // как только партия закончилась — обновляем таблицу и возвращаемся в лобби
  useEffect(() => {
    if (!playing || phase !== 'finished' || !match) return
    setMine({
      date,
      score: knockedOutCount(match.world),
      throws: match.players[0]!.throwsUsed,
      accuracy: match.players[0]!.hits / Math.max(1, match.players[0]!.throwsUsed),
    })
    const timer = window.setTimeout(() => {
      setPlaying(false)
      void refresh()
    }, 2200)
    return () => clearTimeout(timer)
  }, [playing, phase, match, date, refresh])

  if (playing && match && match.mode === 'daily') {
    const player = match.players[0]!
    return (
      <GameView match={match}>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 sm:p-3">
          <div className="flex min-w-0 flex-1 flex-col items-center rounded-2xl bg-black/50 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
            <span className="text-[10px] uppercase tracking-wider text-steppe-300">
              {t('daily.title')} · {date}
            </span>
            <div className="mt-1 flex items-center gap-4">
              <span className="text-base font-bold text-gold-400">
                {knockedOutCount(match.world)} / {level.goal}
              </span>
              <span className="text-xs text-steppe-300">
                {t('campaign.throws')}:{' '}
                <b className="text-steppe-50">{Math.max(0, level.throws - player.throwsUsed)}</b>
              </span>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center p-3 pb-5">
          <PowerBar />
        </div>
      </GameView>
    )
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
        <h1 className="text-center text-3xl font-extrabold text-steppe-50">{t('daily.title')}</h1>
        <p className="mt-1 text-center text-sm text-steppe-300">
          {date} · {t(MODIFIER_KEY[level.modifier] ?? 'daily.modifier.plain')} ·{' '}
          {level.layout.count + (level.movers?.length ?? 0)} × {level.throws}
        </p>

        <div className="mt-4">
          <BackendBanner />
        </div>

        {alreadyPlayed && mine ? (
          <section className="mt-5 rounded-2xl bg-white/5 p-4 text-center ring-1 ring-white/10">
            <div className="text-xs font-bold uppercase tracking-widest text-gold-400">
              {t('daily.result')}
            </div>
            <div className="mt-2 text-3xl font-extrabold text-steppe-50">
              {mine.score} / {level.goal}
            </div>
            <div className="mt-1 text-xs text-steppe-300">
              {mine.throws} · {percent(mine.accuracy)}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-steppe-300">{t('daily.done')}</p>
          </section>
        ) : (
          <button
            type="button"
            onClick={() => {
              startDaily(level)
              setPlaying(true)
            }}
            className="mt-5 min-h-[44px] w-full rounded-2xl bg-gold-400 p-4 font-bold text-night-900 transition-transform active:scale-[0.98]"
          >
            {t('daily.play')}
          </button>
        )}

        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gold-400">
            {t('daily.board')}
          </h2>
          {board.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-white/5 p-4 text-sm leading-relaxed text-steppe-300 ring-1 ring-white/10">
              {t('daily.empty')}
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-1.5">
              {board.map((row) => (
                <li
                  key={row.user_id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ring-1 ${
                    row.user_id === userId
                      ? 'bg-gold-400/15 ring-gold-400/40'
                      : 'bg-white/5 ring-white/10'
                  }`}
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-steppe-300">
                    {row.rank}
                  </span>
                  <span className="shrink-0 text-base">{AVATAR_EMOJI[row.avatar] ?? '🔴'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-steppe-50">{row.username}</span>
                    {row.university && (
                      <span className="block truncate text-[10px] text-steppe-300">
                        {row.university}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-bold text-gold-400">{row.score}</span>
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-steppe-300">
                    {row.throws}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
