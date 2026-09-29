import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { knockedOutCount } from '@/game/rules'
import { levelById } from '@/levels'
import { GameView } from '@/game/GameView'
import { LevelResult } from '@/components/LevelResult'
import { PowerBar } from '@/components/PowerBar'
import { Stars } from '@/components/Stars'
import { useI18n, useT } from '@/i18n'
import { isUnlocked } from '@/lib/progress'
import { useProgressStore } from '@/store/useProgressStore'
import { usePopupStore } from '@/game/fx/popupStore'
import { useGameStore } from '@/store/useGameStore'

export function LevelPlay() {
  const t = useT()
  const locale = useI18n((s) => s.locale)
  const { levelId } = useParams<{ levelId: string }>()
  const level = levelId ? levelById(levelId) : undefined

  const match = useGameStore((s) => s.match)
  const phase = useGameStore((s) => s.phase)
  const startLevel = useGameStore((s) => s.startLevel)
  const leave = useGameStore((s) => s.leave)

  const progressMap = useProgressStore((s) => s.progress)
  const allowed = level ? isUnlocked(level.id, progressMap) : false

  useEffect(() => {
    if (!level || !allowed) return
    startLevel(level)
    return () => {
      leave()
      usePopupStore.getState().clear()
    }
  }, [level, allowed, startLevel, leave])

  if (!level) return <Navigate to="/campaign" replace />
  if (!allowed) return <Navigate to="/campaign" replace />
  if (!match || match.mode !== 'campaign') {
    return (
      <div className="flex h-full items-center justify-center text-steppe-300">
        {t('common.loading')}
      </div>
    )
  }

  const player = match.players[0]!
  const knocked = knockedOutCount(match.world)
  const left = level.throws - player.throwsUsed
  const progress = progressMap[level.id]

  return (
    <GameView match={match}>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 sm:p-3">
        <Link
          to="/campaign"
          className="pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/50 px-3 text-sm font-semibold text-steppe-50 ring-1 ring-white/15 backdrop-blur-sm"
        >
          ←
        </Link>

        <div className="flex min-w-0 flex-1 flex-col items-center rounded-2xl bg-black/50 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[10px] uppercase tracking-wider text-steppe-300">
              {level.chapterTitle[locale]} · {t('campaign.level')} {level.number}
            </span>
            <Stars value={progress ? progress.stars : 0} size={11} />
          </div>
          <div className="mt-1 flex items-center gap-4">
            <span className="text-base font-bold text-gold-400">
              {knocked} / {level.goal}
            </span>
            <span className="text-xs text-steppe-300">
              {t('campaign.throws')}: <b className="text-steppe-50">{Math.max(left, 0)}</b>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {level.wind && (
            <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-sky-450 ring-1 ring-white/15">
              {t('hud.wind')} {level.wind.x > 0 ? '→' : level.wind.x < 0 ? '←' : ''}
              {level.wind.y > 0 ? '↑' : level.wind.y < 0 ? '↓' : ''}
            </span>
          )}
          {level.maxPower !== undefined && (
            <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-gold-400 ring-1 ring-white/15">
              {t('hud.maxPower')}
            </span>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-5">
        <PowerBar />
      </div>

      {phase === 'finished' && <LevelResult match={match} level={level} />}
    </GameView>
  )
}
