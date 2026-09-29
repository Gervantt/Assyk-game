import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PHYSICS } from '@/physics'
import { useAimStore } from '@/store/useAimStore'
import { toSceneZ } from './coords'

const DASHES = 7
/** Показываем лишь малую часть реального пути — это подсказка, а не предсказатель. */
const PREVIEW_FRACTION = 0.2

/** Короткий пунктир направления от сақа. */
export function AimIndicator({ hintLength }: { hintLength?: number }) {
  const fraction = hintLength ?? PREVIEW_FRACTION
  const group = useRef<THREE.Group>(null)
  const dashes = useRef<THREE.Mesh[]>([])
  const geo = useMemo(() => new THREE.PlaneGeometry(0.045, 0.11), [])
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#fff4d0', transparent: true, opacity: 0.85 }),
    [],
  )

  useFrame(() => {
    const aim = useAimStore.getState()
    const g = group.current
    if (!g) return
    g.visible = aim.active
    if (!aim.active) return

    const total = (PHYSICS.minSpeed + (PHYSICS.maxSpeed - PHYSICS.minSpeed) * aim.power) * 0.55 * fraction
    const startGap = PHYSICS.sakaRadius + 0.04
    for (let i = 0; i < DASHES; i++) {
      const m = dashes.current[i]
      if (!m) continue
      const d = startGap + (total * (i + 1)) / DASHES
      m.position.set(aim.dirX * d, 0.02, toSceneZ(aim.dirY * d))
      m.position.x += aim.originX
      m.position.z += toSceneZ(aim.originY)
      m.rotation.set(-Math.PI / 2, 0, Math.atan2(aim.dirX, aim.dirY))
      const fade = 1 - i / (DASHES + 1)
      m.scale.set(fade, fade, 1)
    }
  })

  return (
    <group ref={group}>
      {Array.from({ length: DASHES }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) dashes.current[i] = el
          }}
          geometry={geo}
          material={mat}
        />
      ))}
    </group>
  )
}
