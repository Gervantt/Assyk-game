import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { knockedOutCount } from '@/game/rules'
import { seedFromString, surfaceByName } from '@/physics'
import { GameView } from '@/game/GameView'
import { PowerBar } from '@/components/PowerBar'
import { CameraToggle } from '@/components/CameraToggle'
import { Ornament } from '@/components/Ornament'
import { useT } from '@/i18n'
import { bumpPlays, fetchCustomLevel, type CustomLevelRow } from '@/net/custom'
import { usePopupStore } from '@/game/fx/popupStore'
import { useGameStore } from '@/store/useGameStore'

export function CustomPlay() {
  const t = useT()
  const { levelId } = useParams<{ levelId: string }>()
  const [row, setRow] = useState<CustomLevelRow | null | 'missing'>(null)

  const match = useGameStore((s) => s.match)
  const phase = useGameStore((s) => s.phase)
  const startSession = useGameStore((s) => s.startSession)
  const restart = useGameStore((s) => s.restart)
  const leave = useGameStore((s) => s.leave)

  useEffect(() => {
    if (!levelId) return
    let cancelled = false
    void fetchCustomLevel(levelId).then((r) => {
      if (cancelled) return
      setRow(r ?? 'missing')
      if (r) void bumpPlays(levelId)
    })
    return () => {
      cancelled = true
    }
  }, [levelId])

  const layout = row && row !== 'missing' ? row.layout : null

  useEffect(() => {
    if (!layout) return
    startSession({
      // испытание: бюджет бросков и цель, звёзды не начисляем
      mode: 'campaign',
      layout: {
        kind: 'custom',
        count: layout.asyks.length,
        positions: layout.asyks,
        shape: layout.shape,
        fieldRadius: layout.fieldRadius,
      },
      // рельеф и камни — часть испытания, поэтому seed берётся из его id:
      // у всех, кто открыл ссылку, кон должен быть один и тот же
      seed: seedFromString(`asyq-custom-${levelId}`),
      rules: {
        throwsPerPlayer: layout.throws,
        goal: layout.goal,
        sakaInFieldPenalty: layout.penalty,
        extraThrowOnKnockOut: false,
        comboBonus: false,
      },
      // неизвестное имя поверхности функция сама сводит к безопасному значению
      world: {
        surfaceId: surfaceByName(layout.surface as never),
        obstacles: layout.stones ?? [],
        relief: layout.relief,
      },
    })
    return () => {
      leave()
      usePopupStore.getState().clear()
    }
  }, [layout, levelId, startSession, leave])

  if (row === 'missing') {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4 px-5">
        <p className="text-center text-steppe-300">{t('custom.missing')}</p>
        <Link to="/custom" className="text-sm text-gold-400">
          {t('custom.title')} →
        </Link>
      </div>
    )
  }

  if (!row || !match) {
    return (
      <div className="flex h-full items-center justify-center text-steppe-300">
        {t('common.loading')}
      </div>
    )
  }

  const player = match.players[0]!
  const knocked = knockedOutCount(match.world)
  const goal = layout!.goal === 0 ? layout!.asyks.length : layout!.goal
  const left = layout!.throws - player.throwsUsed
  const won = knocked >= goal

  return (
    <GameView match={match}>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 sm:p-3">
        <Link
          to="/custom"
          className="pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/50 px-3 text-sm font-semibold text-steppe-50 ring-1 ring-white/15 backdrop-blur-sm"
        >
          ←
        </Link>
        <div className="flex min-w-0 flex-1 flex-col items-center rounded-2xl bg-black/50 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
          <span className="max-w-full truncate text-[10px] uppercase tracking-wider text-steppe-300">
            {row.title}
          </span>
          <span className="text-sm font-bold text-steppe-50">
            {knocked} / {goal} · {t('hud.throws')} {left}
          </span>
        </div>
        <CameraToggle />
      </div>

      <PowerBar />

      {phase === 'finished' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-night-900/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-night-800 p-6 text-center ring-1 ring-white/10">
            <Ornament className="mx-auto mb-3 h-3 w-40 text-gold-500/70" />
            <h2 className="text-2xl font-extrabold text-steppe-50">
              {won ? t('custom.won') : t('custom.lost')}
            </h2>
            <p className="mt-2 text-sm text-steppe-300">
              {knocked} / {goal} · {t('result.accuracy')} {player.throwsUsed}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={restart}
                className="min-h-[44px] flex-1 rounded-2xl bg-gold-400 font-bold text-night-900"
              >
                {t('result.again')}
              </button>
              <Link
                to="/custom"
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-white/10 font-bold text-steppe-50 ring-1 ring-white/15"
              >
                {t('custom.title')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </GameView>
  )
}
