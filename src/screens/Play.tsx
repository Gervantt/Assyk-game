import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { MatchMode } from '@/game/rules'
import { GameCanvas } from '@/game/scene/GameCanvas'
import { AimLayer } from '@/game/AimLayer'
import { HUD } from '@/components/HUD'
import { Toasts } from '@/components/Toasts'
import { ResultsOverlay } from '@/components/ResultsOverlay'
import { useT } from '@/i18n'
import { useGameStore } from '@/store/useGameStore'

const MODES: MatchMode[] = ['training', 'hotseat']

export function Play() {
  const t = useT()
  const { mode } = useParams<{ mode: string }>()
  const match = useGameStore((s) => s.match)
  const phase = useGameStore((s) => s.phase)
  const start = useGameStore((s) => s.start)
  const leave = useGameStore((s) => s.leave)

  const valid = MODES.includes(mode as MatchMode) ? (mode as MatchMode) : null

  useEffect(() => {
    if (!valid) return
    start(valid)
    return () => leave()
  }, [valid, start, leave])

  if (!valid) return <Navigate to="/" replace />
  if (!match) {
    return (
      <div className="flex h-full items-center justify-center text-steppe-300">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-night-900">
      <GameCanvas world={match.world} />
      <AimLayer world={match.world} enabled={phase === 'aim'} />
      <HUD match={match} />
      <Toasts />
      {phase === 'finished' && <ResultsOverlay match={match} />}
    </div>
  )
}
