import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { SimEvent } from '@/physics'
import { advancePlayback, playbackIsFinished } from '@/game/playback'
import { emitFx } from '@/game/fx/bus'
import { addShake } from '@/game/fx/shake'
import { playBoneHit, playSound } from '@/audio'
import { HAPTIC, vibrate } from '@/lib/haptics'
import { fullEffects } from '@/store/useSettings'
import { useGameStore } from '@/store/useGameStore'

/**
 * Единственное место, которое двигает часы броска и превращает события
 * симуляции в звук, частицы, тряску и вибрацию.
 *
 * Монтируется первым внутри Canvas: остальные эффекты в том же кадре
 * читают уже обновлённое время.
 */
export function PlaybackDriver() {
  const knockCount = useRef(0)

  useFrame((_, delta) => {
    const { phase, finishPlayback, pushToast } = useGameStore.getState()
    if (phase !== 'animating') {
      // между бросками счётчики должны быть чистыми, иначе комбо «переедет»
      knockCount.current = 0
      return
    }

    const fired = advancePlayback(delta)
    const rich = fullEffects()

    for (const e of fired) handleEvent(e, rich, knockCount, pushToast)

    if (playbackIsFinished()) {
      knockCount.current = 0
      finishPlayback()
    }
  })

  return null
}

function handleEvent(
  e: SimEvent,
  rich: boolean,
  knockCount: { current: number },
  pushToast: (key: 'event.qos' | 'event.keremet' | 'event.knock', tone: 'good' | 'combo') => void,
): void {
  switch (e.type) {
    case 'groundImpact': {
      // настоящее касание земли из симуляции: пыль, отпечаток, глухой удар
      const hard = Math.min(1, e.speed / 4)
      playSound('thud', { volume: 0.25 + hard * 0.45, rate: 0.9 + hard * 0.4 })
      if (rich && e.speed > 0.6) {
        emitFx({ t: 'dust', x: e.x, y: e.y, power: hard })
        emitFx({ t: 'decal', x: e.x, y: e.y, size: 0.6 + hard * 0.6 })
        addShake(Math.min(0.03, e.speed * 0.006))
      }
      break
    }
    case 'bodyHit': {
      const impulse = Math.abs(e.impulse)
      playBoneHit(impulse)
      if (rich) {
        emitFx({ t: 'sparks', x: e.x, y: e.y, power: Math.min(1, impulse / 6) })
        addShake(Math.min(0.09, impulse * 0.012))
      }
      break
    }
    case 'knockOut': {
      knockCount.current += 1
      playSound('coin', { volume: 0.55, rate: 1 + knockCount.current * 0.06 })
      vibrate(HAPTIC.knock)
      emitFx({ t: 'knock', x: e.x, y: e.y, index: knockCount.current })
      if (rich) emitFx({ t: 'dust', x: e.x, y: e.y, power: 0.35 })

      if (knockCount.current === 2) {
        pushToast('event.qos', 'combo')
        playSound('combo', { volume: 0.7 })
        vibrate(HAPTIC.combo)
        emitFx({ t: 'combo', kind: 'qos' })
      } else if (knockCount.current === 3) {
        pushToast('event.keremet', 'combo')
        playSound('combo', { volume: 0.85, rate: 1.16 })
        vibrate(HAPTIC.combo)
        emitFx({ t: 'combo', kind: 'keremet' })
      } else if (knockCount.current === 1) {
        pushToast('event.knock', 'good')
      }
      break
    }
    case 'wallBounce': {
      playSound('thud', { volume: 0.3, rate: 1.3 })
      if (rich) addShake(0.02)
      break
    }
    default:
      break
  }
}
