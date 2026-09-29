import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeThrow, predictTrajectory, type WorldState } from '@/physics'
import { useAimStore } from '@/store/useAimStore'
import { useGameStore } from '@/store/useGameStore'
import { toSceneZ } from './coords'

/**
 * Подсказка траектории. Считается ТЕМ ЖЕ модулем физики, но без столкновений:
 * это честная дуга полёта, а не предсказатель результата — стоит сақа кого-то
 * задеть, и всё пойдёт иначе.
 */
export type PreviewMode = 'full' | 'medium' | 'short'

/** Доля дуги и показывать ли кольцо первого касания. */
const PREVIEW: Record<PreviewMode, { fraction: number; ring: boolean }> = {
  full: { fraction: 1, ring: true },
  medium: { fraction: 0.35, ring: true },
  short: { fraction: 0.2, ring: false },
}

const DOTS = 40
/** пересчитываем дугу не чаще, чем раз в N кадров */
const RECALC_EVERY = 2

export function AimIndicator({ world, preview = 'short' }: { world: WorldState; preview?: PreviewMode }) {
  const dotsRef = useRef<THREE.InstancedMesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const arrowRef = useRef<THREE.Mesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const frameCount = useRef(0)
  const cached = useRef<{ points: Array<{ x: number; y: number; z: number }>; touch: { x: number; y: number } | null }>(
    { points: [], touch: null },
  )

  useFrame(() => {
    const aim = useAimStore.getState()
    const dots = dotsRef.current
    const ring = ringRef.current
    const arrow = arrowRef.current
    if (!dots || !ring || !arrow) return

    // стрелка направления на земле — пока выбираем, куда бросать
    const showArrow = aim.mode === 'direction' || (aim.mode === 'idle' && !aim.active)
    arrow.visible = showArrow
    if (showArrow) {
      arrow.position.set(0, 0.012, toSceneZ(world.throwLineY) - 0.55)
      arrow.rotation.set(-Math.PI / 2, 0, -aim.yaw)
    }

    if (!aim.active) {
      dots.count = 0
      ring.visible = false
      return
    }

    frameCount.current++
    if (frameCount.current % RECALC_EVERY === 0 || cached.current.points.length === 0) {
      const maxPower = useGameStore.getState().session?.maxPower ?? 1
      const input = makeThrow(aim, { x: aim.originX, y: aim.originY }, maxPower)
      const t = predictTrajectory(input, world.surfaceId, undefined, 1.9)
      cached.current.points = t.points
      cached.current.touch = t.firstTouch
    }

    const cfg = PREVIEW[preview]
    const all = cached.current.points
    const shown = Math.max(2, Math.floor(all.length * cfg.fraction))
    const step = Math.max(1, Math.floor(shown / DOTS))
    let n = 0
    for (let i = 0; i < shown && n < DOTS; i += step) {
      const p = all[i]!
      const fade = 1 - n / DOTS
      dummy.position.set(p.x, p.z, toSceneZ(p.y))
      dummy.scale.setScalar(0.026 * (0.45 + fade * 0.55))
      dummy.updateMatrix()
      dots.setMatrixAt(n, dummy.matrix)
      n++
    }
    dots.count = n
    dots.instanceMatrix.needsUpdate = true

    const touch = cached.current.touch
    ring.visible = Boolean(cfg.ring && touch)
    if (cfg.ring && touch) {
      ring.position.set(touch.x, 0.014, toSceneZ(touch.y))
    }
  })

  return (
    <group>
      <instancedMesh ref={dotsRef} args={[undefined, undefined, DOTS]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#fff4d0" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </instancedMesh>

      {/* кольцо первого касания земли */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.1, 0.135, 28]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.8} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* стрелка направления на земле */}
      <mesh ref={arrowRef} visible={false}>
        <coneGeometry args={[0.1, 0.3, 3]} />
        <meshBasicMaterial color="#ffe9a8" transparent opacity={0.6} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
