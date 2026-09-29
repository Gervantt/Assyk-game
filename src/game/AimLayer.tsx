import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AIM,
  aimFromAngles,
  aimFromPull,
  BODY_ASYK,
  clamp,
  makeThrow,
  PHYSICS,
  type AimState,
  type WorldState,
} from '@/physics'
import { screenToGround } from '@/game/scene/projection'
import { useAimStore } from '@/store/useAimStore'
import { playSound } from '@/audio'
import { useGameStore } from '@/store/useGameStore'

/** Тап считается тапом, если палец сдвинулся меньше чем на столько пикселей. */
const TAP_SLOP = 10
/** Насколько близко к асыку нужно ткнуть, м. */
const TAP_RADIUS = 0.45

/** Доля меньшей стороны экрана, за которую тяга достигает максимума. */
const MAX_PULL_RATIO = 0.26
/** Свайп на эту долю экрана поворачивает направление на весь диапазон. */
const SWIPE_RATIO = 0.42
/** Порог, после которого жест определяется как поворот или как натяжение. */
const GESTURE_THRESHOLD = 12
const KEY_POWER_RATE = 0.85
const KEY_ANGLE_RATE = 1.1

function shortSide(): number {
  return Math.min(window.innerWidth, window.innerHeight)
}

export interface AimLayerProps {
  world: WorldState
  enabled: boolean
  /** ограничение силы уровня, 0..1 */
  maxPower?: number
  /** обучение может зафиксировать угол подъёма кнопкой-пресетом */
  elevationLock?: number | null
  /** обучение может не пропустить бросок */
  gate?: (aim: AimState) => boolean
}

/**
 * Два жеста вместо одного.
 *   1. Горизонтальный свайп — направление броска, камера поворачивается следом.
 *   2. Натяжение вниз — сила (длина) и угол подъёма (наклон тяги).
 * Какой это жест, решается по первому заметному движению пальца.
 */
export function AimLayer({ world, enabled, maxPower = 1, elevationLock = null, gate }: AimLayerProps) {
  const startRef = useRef<{ x: number; y: number; id: number; yaw: number } | null>(null)
  const movedRef = useRef(0)
  const [band, setBand] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const throwSaka = useGameStore((s) => s.throwSaka)

  const origin = { x: 0, y: world.throwLineY }

  const applyPull = useCallback(
    (dx: number, dy: number, yaw: number) => {
      const aim = aimFromPull(yaw, { dx, dy, maxPull: shortSide() * MAX_PULL_RATIO })
      useAimStore.getState().setAim({
        ...aim,
        elevation: elevationLock ?? aim.elevation,
        originX: origin.x,
        originY: origin.y,
      })
    },
    [elevationLock, origin.x, origin.y],
  )

  const release = useCallback(() => {
    const aim = useAimStore.getState()
    if (aim.mode === 'pull' && aim.active && aim.power > 0 && (!gate || gate(aim))) {
      throwSaka(makeThrow(aim, { x: aim.originX, y: aim.originY }, maxPower))
    }
    useAimStore.getState().reset()
    startRef.current = null
    setBand(null)
  }, [throwSaka, maxPower, gate])

  /**
   * Тап по асыку: стрелка наводится прямо на него, а сам асық помечается
   * жёлтым кольцом. Прицел при этом остаётся ручным — свайп его сбросит.
   */
  const tapTarget = useCallback(
    (px: number, py: number) => {
      const ground = screenToGround(px, py)
      if (!ground) return
      let picked: { id: number; x: number; y: number } | null = null
      let best = TAP_RADIUS
      for (const b of world.bodies) {
        if (b.kind !== BODY_ASYK || b.removed || b.outOfField) continue
        const d = Math.hypot(b.x - ground.x, b.y - ground.y)
        if (d < best) {
          best = d
          picked = { id: b.id, x: b.x, y: b.y }
        }
      }
      if (!picked) return
      const store = useAimStore.getState()
      const yaw = clamp(
        Math.atan2(picked.x - origin.x, picked.y - origin.y),
        -AIM.maxYaw,
        AIM.maxYaw,
      )
      store.setYaw(yaw)
      store.setTarget(picked.id)
      playSound('tap')
    },
    [origin.x, origin.y, world],
  )

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, yaw: useAimStore.getState().yaw }
    movedRef.current = 0
    useAimStore.getState().setMode('idle')
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = startRef.current
    if (!enabled || !s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    movedRef.current = Math.max(movedRef.current, Math.hypot(dx, dy))
    const store = useAimStore.getState()

    if (store.mode === 'idle') {
      if (Math.abs(dx) < GESTURE_THRESHOLD && Math.abs(dy) < GESTURE_THRESHOLD) return
      // тянем вниз — это натяжение; ведём вбок — это поворот направления
      store.setMode(dy > GESTURE_THRESHOLD && Math.abs(dy) >= Math.abs(dx) ? 'pull' : 'direction')
    }

    const mode = useAimStore.getState().mode
    if (mode === 'direction') {
      const span = shortSide() * SWIPE_RATIO
      useAimStore.getState().setYaw(clamp(s.yaw + (dx / span) * AIM.maxYaw * 2, -AIM.maxYaw, AIM.maxYaw))
      setBand(null)
    } else if (mode === 'pull') {
      applyPull(dx, dy, useAimStore.getState().yaw)
      setBand({ x0: s.x, y0: s.y, x1: e.clientX, y1: e.clientY })
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = startRef.current
    if (!s || s.id !== e.pointerId) return
    // палец почти не двигался — это тап, а не жест
    if (movedRef.current < TAP_SLOP && useAimStore.getState().mode === 'idle') {
      tapTarget(e.clientX, e.clientY)
      startRef.current = null
      setBand(null)
      return
    }
    release()
  }

  // --- клавиатура: стрелки — поворот, W/S — угол подъёма, пробел — сила ---
  const keys = useRef({ left: false, right: false, up: false, down: false, space: false })
  const elevation = useRef(PHYSICS.maxElevation * 0.35)
  const power = useRef(0)

  useEffect(() => {
    if (!enabled) return
    let raf = 0
    let prev = performance.now()

    const tick = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05)
      prev = now
      const k = keys.current
      const store = useAimStore.getState()
      let touched = false

      if (k.left || k.right) {
        const delta = (k.right ? 1 : -1) * KEY_ANGLE_RATE * dt
        store.setYaw(clamp(store.yaw + delta, -AIM.maxYaw, AIM.maxYaw))
        store.setMode('direction')
        touched = true
      }
      if (k.up) elevation.current = Math.min(PHYSICS.maxElevation, elevation.current + KEY_ANGLE_RATE * dt)
      if (k.down) elevation.current = Math.max(0, elevation.current - KEY_ANGLE_RATE * dt)
      if (k.space) {
        power.current = Math.min(1, power.current + KEY_POWER_RATE * dt)
        store.setMode('pull')
        touched = true
      }
      if (touched || k.up || k.down) {
        store.setAim({
          ...aimFromAngles(store.yaw, elevationLock ?? elevation.current, Math.max(power.current, 0.02)),
          originX: origin.x,
          originY: origin.y,
        })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.current.left = true
      else if (e.key === 'ArrowRight') keys.current.right = true
      else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keys.current.up = true
      else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keys.current.down = true
      else if (e.code === 'Space') {
        e.preventDefault()
        keys.current.space = true
      } else return
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.current.left = false
      else if (e.key === 'ArrowRight') keys.current.right = false
      else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keys.current.up = false
      else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keys.current.down = false
      else if (e.code === 'Space') {
        keys.current.space = false
        if (power.current > 0) {
          const store = useAimStore.getState()
          const aim = aimFromAngles(store.yaw, elevationLock ?? elevation.current, power.current)
          if (!gate || gate(aim)) throwSaka(makeThrow(aim, origin, maxPower))
          power.current = 0
          store.reset()
        }
      }
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [enabled, origin.x, origin.y, throwSaka, maxPower, gate, elevationLock])

  return (
    <div
      className="absolute inset-0 touch-none"
      style={{ cursor: enabled ? 'crosshair' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* резинка рогатки */}
      {band && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <line
            x1={band.x1}
            y1={band.y1}
            x2={band.x0}
            y2={band.y0}
            stroke="#f0c23c"
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.75}
          />
          <circle cx={band.x0} cy={band.y0} r={7} fill="none" stroke="#f0c23c" strokeWidth={2} opacity={0.5} />
          <circle cx={band.x1} cy={band.y1} r={11} fill="#f0c23c" opacity={0.25} />
        </svg>
      )}
    </div>
  )
}
