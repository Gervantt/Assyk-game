import type { ReactNode } from 'react'
import type { AimState } from '@/physics'
import type { MatchState } from '@/game/rules'
import { GameCanvas } from '@/game/scene/GameCanvas'
import { AimLayer } from '@/game/AimLayer'
import { Popups } from '@/game/fx/Popups'
import { Toasts } from '@/components/Toasts'
import { Confetti } from '@/components/Confetti'
import { useGameStore } from '@/store/useGameStore'

export interface GameViewProps {
  match: MatchState
  /** доля траектории в пунктире прицела: в обучении длиннее */
  hintLength?: number
  /** обучение может не пропустить бросок */
  gate?: (aim: AimState) => boolean
  /** свой HUD поверх сцены */
  children?: ReactNode
}

/** Общая игровая поверхность: сцена, управление, эффекты. */
export function GameView({ match, hintLength, gate, children }: GameViewProps) {
  const phase = useGameStore((s) => s.phase)
  const celebrate = useGameStore((s) => s.celebrate)
  const maxPower = useGameStore((s) => s.session?.maxPower ?? 1)

  return (
    <div className="relative h-full w-full overflow-hidden bg-night-900">
      <GameCanvas world={match.world} hintLength={hintLength} />
      <AimLayer world={match.world} enabled={phase === 'aim'} maxPower={maxPower} gate={gate} />
      {children}
      <Popups />
      <Toasts />
      <Confetti active={celebrate} />
    </div>
  )
}
