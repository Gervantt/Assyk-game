import { useCallback, useEffect, useRef } from 'react'
import { aimFromAngle, aimFromPull, makeThrow, type WorldState } from '@/physics'
import { useAimStore } from '@/store/useAimStore'
import { useGameStore } from '@/store/useGameStore'

/** Доля меньшей стороны экрана, за которую тяга достигает максимума. */
const MAX_PULL_RATIO = 0.26
/** Скорость набора силы с клавиатуры, доля в секунду. */
const KEY_POWER_RATE = 0.85
const KEY_ANGLE_RATE = 1.5

function maxPullPx(): number {
  return Math.min(window.innerWidth, window.innerHeight) * MAX_PULL_RATIO
}

/**
 * «Рогатка»: зажать в любой точке, тянуть назад, отпустить.
 * Направление = противоположно вектору тяги, сила = длина тяги.
 * Работает мышью и касанием через Pointer Events.
 */
export function AimLayer({ world, enabled }: { world: WorldState; enabled: boolean }) {
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null)
  const throwSaka = useGameStore((s) => s.throwSaka)

  const origin = { x: 0, y: world.throwLineY }

  const update = useCallback(
    (dxPx: number, dyPx: number) => {
      // экран: +x вправо, +y вниз. Мир: +x вправо, +y от игрока. Отсюда знак у dy.
      const aim = aimFromPull({ dx: dxPx, dy: -dyPx, maxPull: maxPullPx() })
      useAimStore.setState({ ...aim, originX: origin.x, originY: origin.y })
    },
    [origin.x, origin.y],
  )

  const release = useCallback(() => {
    const aim = useAimStore.getState()
    if (aim.active && aim.power > 0) {
      throwSaka(makeThrow(aim, { x: aim.originX, y: aim.originY }))
    }
    useAimStore.getState().reset()
    startRef.current = null
  }, [throwSaka])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    update(0, 0)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = startRef.current
    if (!enabled || !s || s.id !== e.pointerId) return
    update(e.clientX - s.x, e.clientY - s.y)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = startRef.current
    if (!s || s.id !== e.pointerId) return
    release()
  }

  // --- клавиатура (доступность): стрелки — угол, пробел удерживать — сила ---
  const keys = useRef({ left: false, right: false, space: false })
  const angle = useRef(Math.PI / 2)
  const power = useRef(0)

  useEffect(() => {
    if (!enabled) return
    let raf = 0
    let prev = performance.now()

    const tick = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05)
      prev = now
      const k = keys.current
      if (k.left) angle.current += KEY_ANGLE_RATE * dt
      if (k.right) angle.current -= KEY_ANGLE_RATE * dt
      if (k.space) power.current = Math.min(1, power.current + KEY_POWER_RATE * dt)
      if (k.left || k.right || k.space) {
        useAimStore.setState({
          ...aimFromAngle(angle.current, Math.max(power.current, 0.02)),
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
      else if (e.code === 'Space') {
        e.preventDefault()
        keys.current.space = true
      } else return
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.current.left = false
      else if (e.key === 'ArrowRight') keys.current.right = false
      else if (e.code === 'Space') {
        keys.current.space = false
        if (power.current > 0) {
          const aim = aimFromAngle(angle.current, power.current)
          throwSaka(makeThrow(aim, origin))
          power.current = 0
          useAimStore.getState().reset()
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
  }, [enabled, origin.x, origin.y, throwSaka])

  return (
    <div
      className="absolute inset-0 touch-none"
      style={{ cursor: enabled ? 'crosshair' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  )
}
