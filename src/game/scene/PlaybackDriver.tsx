import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PHYSICS, type SimEvent } from '@/physics'
import { advancePlayback, getPlayback, playbackIsFinished } from '@/game/playback'
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
  const landed = useRef(false)

  useFrame((_, delta) => {
    const { phase, finishPlayback, pushToast } = useGameStore.getState()
    if (phase !== 'animating') {
      // между бросками счётчики должны быть чистыми, иначе комбо «переедет»
      knockCount.current = 0
      landed.current = false
      return
    }

    const fired = advancePlayback(delta)
    const rich = fullEffects()

    for (const e of fired) handleEvent(e, rich, knockCount, pushToast)

    // приземление сақа после дуги полёта: пыль, отпечаток, глухой удар
    const pb = getPlayback()
    if (!landed.current && pb.t >= PHYSICS.flightTicks * PHYSICS.dt) {
      landed.current = true
      const frame = pb.frames[Math.min(Math.floor(pb.t / (PHYSICS.dt * PHYSICS.frameEvery)), pb.frames.length - 1)]
      const saka = frame?.bodies[0]
      if (saka && !saka.removed) {
        playSound('thud', { volume: 0.45 })
        if (rich) {
          emitFx({ t: 'dust', x: saka.x, y: saka.y, power: 0.55 })
          emitFx({ t: 'decal', x: saka.x, y: saka.y, size: 1 })
        }
      }
    }

    if (playbackIsFinished()) {
      knockCount.current = 0
      landed.current = false
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
    case 'hit': {
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
