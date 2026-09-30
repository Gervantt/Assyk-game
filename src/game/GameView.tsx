import { useEffect, type ReactNode } from 'react'
import type { AimState } from '@/physics'
import type { MatchState } from '@/game/rules'
import { GameCanvas } from '@/game/scene/GameCanvas'
import type { PreviewMode } from '@/game/scene/AimIndicator'
import { AimLayer } from '@/game/AimLayer'
import { Popups } from '@/game/fx/Popups'
import { Toasts } from '@/components/Toasts'
import { Confetti } from '@/components/Confetti'
import { resetCamera } from '@/game/camera/cameraDirector'
import { useGameStore } from '@/store/useGameStore'
import { startMusic, stopMusic } from '@/audio'

/** Сколько траектории показывать: в обучении всю, в рейтинге почти ничего. */
const PREVIEW_BY_MODE: Record<string, PreviewMode> = {
  tutorial: 'full',
  training: 'medium',
  campaign: 'medium',
  hotseat: 'medium',
  daily: 'short',
}

export interface GameViewProps {
  match: MatchState
  /** в онлайне бросать можно только в свою очередь */
  canThrow?: boolean
  /** обучение может зафиксировать угол подъёма кнопкой-пресетом */
  elevationLock?: number | null
  /** обучение может не пропустить бросок */
  gate?: (aim: AimState) => boolean
  /** свой HUD поверх сцены */
  children?: ReactNode
}

/** Общая игровая поверхность: сцена, управление, эффекты. */
export function GameView({ match, canThrow = true, elevationLock, gate, children }: GameViewProps) {
  const phase = useGameStore((s) => s.phase)
  const celebrate = useGameStore((s) => s.celebrate)
  const maxPower = useGameStore((s) => s.session?.maxPower ?? 1)

  useEffect(() => {
    resetCamera()
  }, [match.mode])

  // Күй звучит только пока открыт игровой экран. Браузер не даст включить
  // звук до первого жеста — тогда музыка подхватится из unlockAudio().
  useEffect(() => {
    startMusic()
    return () => stopMusic()
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden bg-night-900">
      <GameCanvas world={match.world} preview={PREVIEW_BY_MODE[match.mode] ?? 'medium'} />
      <AimLayer
        world={match.world}
        enabled={phase === 'aim' && canThrow}
        maxPower={maxPower}
        elevationLock={elevationLock}
        gate={gate}
      />
      {children}
      <Popups />
      <Toasts />
      <Confetti active={celebrate} />
    </div>
  )
}
