import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { fieldContains, type SimEvent, type WorldState } from '@/physics'
import { advancePlayback, playbackIsFinished, playbackPlan } from '@/game/playback'
import { emitFx } from '@/game/fx/bus'
import { addShake } from '@/game/fx/shake'
import { playBoneHit, playSound } from '@/audio'
import { HAPTIC, vibrate } from '@/lib/haptics'
import { fullEffects, richEffects } from '@/store/useSettings'
import { useGameStore } from '@/store/useGameStore'
import type { DictKey } from '@/i18n'

/** Ступени эскалации за один бросок. */
const COMBO_LABEL: DictKey[] = ['event.zhaksy', 'event.qos', 'event.keremet', 'event.gazhap']

type Push = (key: DictKey, tone: 'good' | 'bad' | 'combo') => void

/**
 * Единственное место, которое двигает часы броска и превращает события
 * симуляции в звук, частицы, тряску и вибрацию.
 *
 * Монтируется первым внутри Canvas: остальные эффекты в том же кадре
 * читают уже обновлённое время.
 */
export function PlaybackDriver({ world }: { world: WorldState }) {
  const knockCount = useRef(0)
  const turaShown = useRef(false)

  useFrame((_, delta) => {
    const { phase, finishPlayback, pushToast } = useGameStore.getState()
    if (phase !== 'animating') {
      knockCount.current = 0
      turaShown.current = false
      return
    }

    const fired = advancePlayback(delta)
    const rich = richEffects()
    const full = fullEffects()
    const intensity = playbackPlan().intensity

    for (const e of fired) {
      handleEvent(e, { rich, full, intensity, world, knockCount, turaShown, pushToast })
    }

    if (playbackIsFinished()) {
      knockCount.current = 0
      turaShown.current = false
      finishPlayback()
    }
  })

  return null
}

interface Ctx {
  rich: boolean
  full: boolean
  intensity: number
  world: WorldState
  knockCount: { current: number }
  turaShown: { current: boolean }
  pushToast: Push
}

function handleEvent(e: SimEvent, c: Ctx): void {
  switch (e.type) {
    case 'groundImpact': {
      const hard = Math.min(1, e.speed / 4)
      if (e.speed < 0.5) break
      playSound('thud', { volume: 0.2 + hard * 0.45, rate: 0.9 + hard * 0.4, pan: e.x })
      if (c.rich) {
        emitFx({ t: 'dust', x: e.x, y: e.y, power: hard })
        emitFx({ t: 'decal', x: e.x, y: e.y, size: 0.6 + hard * 0.6 })
      }
      if (c.full) addShake(Math.min(0.03, e.speed * 0.005))
      break
    }

    case 'bodyHit': {
      const impulse = Math.abs(e.impulse)
      playBoneHit(impulse, e.x)
      if (c.rich) emitFx({ t: 'sparks', x: e.x, y: e.y, power: Math.min(1, impulse / 6) })
      if (c.full) {
        emitFx({ t: 'shockwave', x: e.x, y: e.y, power: Math.min(1, impulse / 7) })
        addShake(Math.min(0.12, impulse * 0.012 * c.intensity))
      }
      // «Тура!» — попал по асыку, пока тот был в воздухе
      if (e.inAir && !c.turaShown.current) {
        c.turaShown.current = true
        c.pushToast('event.tura', 'combo')
        playSound('coin', { volume: 0.7, rate: 1.45, pan: e.x })
        vibrate(HAPTIC.knock)
      }
      break
    }

    case 'knockOut': {
      c.knockCount.current += 1
      const n = c.knockCount.current
      playSound('coin', { volume: 0.55, rate: 1 + n * 0.07, pan: e.x })
      vibrate(n >= 2 ? HAPTIC.combo : HAPTIC.knock)
      emitFx({ t: 'knock', x: e.x, y: e.y, index: n })
      emitFx({ t: 'coin', x: e.x, y: e.y })
      if (c.rich) {
        emitFx({ t: 'dust', x: e.x, y: e.y, power: 0.35 })
        // вспышка мела там, где асық пересёк линию
        if (!fieldContains(c.world.field, e.x, e.y)) emitFx({ t: 'chalk', x: e.x, y: e.y })
      }

      const label = COMBO_LABEL[Math.min(n, COMBO_LABEL.length) - 1]!
      c.pushToast(label, n === 1 ? 'good' : 'combo')
      if (n >= 2) playSound('combo', { volume: 0.6 + n * 0.08, rate: 1 + (n - 2) * 0.1 })
      if (c.full && n >= 2) addShake(0.05 * n)
      break
    }

    case 'nearMiss': {
      // «Ууу, чуть не задел» — только если промах был совсем близким
      if (e.distance > 0.16) break
      c.pushToast('event.nearMiss', 'bad')
      playSound('whoosh', { volume: 0.35, rate: 1.3 })
      break
    }

    case 'wallBounce': {
      playSound('thud', { volume: 0.3, rate: 1.3 })
      if (c.full) addShake(0.02)
      break
    }

    default:
      break
  }
}
