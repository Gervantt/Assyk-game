import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { onFx } from './bus'
import { usePopupStore } from './popupStore'
import { toSceneZ } from '@/game/scene/coords'

/** Внутри Canvas: ловит выбивание и проецирует точку в экранные координаты. */
export function PopupEmitter() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useEffect(() => {
    const v = new THREE.Vector3()
    // копилка игрока — счётчик в верхней части HUD
    const hudX = size.width / 2
    const hudY = 74

    return onFx((e) => {
      if (e.t === 'knock') {
        v.set(e.x, 0.3, toSceneZ(e.y)).project(camera)
        usePopupStore.getState().push(
          (v.x * 0.5 + 0.5) * size.width,
          (-v.y * 0.5 + 0.5) * size.height,
          '+1',
        )
        return
      }
      if (e.t === 'coin') {
        v.set(e.x, 0.15, toSceneZ(e.y)).project(camera)
        const left = (v.x * 0.5 + 0.5) * size.width
        const top = (-v.y * 0.5 + 0.5) * size.height
        usePopupStore.getState().pushCoin(left, top, hudX - left, hudY - top)
      }
    })
  }, [camera, size])

  return null
}

/** Снаружи Canvas: сами надписи и летящие в копилку асыки. */
export function Popups() {
  const items = usePopupStore((s) => s.items)
  const coins = usePopupStore((s) => s.coins)
  const drop = usePopupStore((s) => s.drop)
  const dropCoin = usePopupStore((s) => s.dropCoin)

  useEffect(() => {
    if (items.length === 0) return
    const timers = items.map((p) => window.setTimeout(() => drop(p.id), 1100))
    return () => timers.forEach(clearTimeout)
  }, [items, drop])

  useEffect(() => {
    if (coins.length === 0) return
    const timers = coins.map((c) => window.setTimeout(() => dropCoin(c.id), 850))
    return () => timers.forEach(clearTimeout)
  }, [coins, dropCoin])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((p) => (
        <span
          key={p.id}
          className="animate-float absolute -translate-x-1/2 -translate-y-1/2 text-2xl font-extrabold text-gold-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
          style={{ left: p.left, top: p.top }}
        >
          {p.text}
        </span>
      ))}

      {coins.map((c) => (
        <span
          key={c.id}
          className="animate-coin absolute text-lg"
          style={
            {
              left: c.left,
              top: c.top,
              '--coin-dx': `${c.dx}px`,
              '--coin-dy': `${c.dy}px`,
            } as React.CSSProperties
          }
        >
          🦴
        </span>
      ))}
    </div>
  )
}
