import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BODY_ASYK,
  BODY_STONE,
  makeThrow,
  PHYSICS,
  predictTrajectory,
  type WorldState,
} from '@/physics'
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

/** Длина стрелки направления по земле, м. */
const ARROW_LENGTH = 1.35
/** Сколько шевронов бежит вдоль древка. */
const CHEVRONS = 3

export function AimIndicator({ world, preview = 'short' }: { world: WorldState; preview?: PreviewMode }) {
  const asyks = useMemo(() => world.bodies.filter((b) => b.kind === BODY_ASYK), [world])
  // камни на пути обрывают подсказку: сақа до них и долетит
  const obstacles = useMemo(
    () =>
      world.bodies
        .filter((b) => b.kind === BODY_STONE && !b.removed)
        .map((b) => ({ x: b.x, y: b.y, z: b.z, radius: b.radius })),
    [world],
  )
  const dotsRef = useRef<THREE.InstancedMesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const arrowRef = useRef<THREE.Group>(null)
  const chevronsRef = useRef<THREE.Group>(null)
  const targetRef = useRef<THREE.Mesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const frameCount = useRef(0)
  const clock = useRef(0)
  const cached = useRef<{
    points: Array<{ x: number; y: number; z: number }>
    touch: { x: number; y: number } | null
    blocked: { x: number; y: number } | null
  }>({ points: [], touch: null, blocked: null })

  useFrame((_, delta) => {
    const aim = useAimStore.getState()
    const dots = dotsRef.current
    const ring = ringRef.current
    const arrow = arrowRef.current
    const target = targetRef.current
    if (!dots || !ring || !arrow || !target) return
    clock.current += delta

    /*
     * Кольцо на выбранной тапом цели. Держится, пока игрок не повернёт
     * прицел вручную — тогда стор сам сбрасывает выбор.
     */
    const picked = aim.targetId !== null ? asyks.find((b) => b.id === aim.targetId) : undefined
    const showTarget = Boolean(picked && !picked.removed && !picked.outOfField && aim.mode !== 'pull')
    target.visible = showTarget
    if (showTarget && picked) {
      target.position.set(picked.x, 0.015, toSceneZ(picked.y))
      const pulse = 1 + Math.sin(clock.current * 4.2) * 0.07
      target.scale.setScalar(pulse)
      const mat = target.material as THREE.MeshBasicMaterial
      mat.opacity = 0.75 + Math.sin(clock.current * 4.2) * 0.15
    }

    /*
     * Стрелка направления. Видна ДО натяжения: показывает, куда полетит сақа,
     * если отпустить прямо сейчас. Как только игрок начал тянуть, её сменяет
     * дуга траектории — иначе две подсказки спорили бы друг с другом.
     */
    const showArrow = aim.mode !== 'pull'
    arrow.visible = showArrow
    if (showArrow) {
      arrow.position.set(0, 0, toSceneZ(world.throwLineY))
      // поворот вокруг вертикали: при yaw = 0 стрелка смотрит прямо на кон
      arrow.rotation.set(0, -aim.yaw, 0)
      // мягкое дыхание, чтобы стрелку было видно на песке
      const breathe = 0.62 + Math.sin(clock.current * 2.6) * 0.12
      arrow.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined
        if (mat && mat.transparent) mat.opacity = breathe
      })
      // шевроны бегут вперёд, подсказывая направление
      const chevrons = chevronsRef.current
      if (chevrons) {
        chevrons.children.forEach((child, i) => {
          const t = ((clock.current * 0.55 + i / CHEVRONS) % 1)
          child.position.z = -(0.3 + t * (ARROW_LENGTH - 0.55))
          const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
          mat.opacity = Math.sin(t * Math.PI) * 0.55
        })
      }
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
      const t = predictTrajectory(input, world.surfaceId, undefined, 1.9, obstacles)
      cached.current.points = t.points
      cached.current.touch = t.firstTouch
      cached.current.blocked = t.blockedAt
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

    // если на пути камень — кольцо показывает именно место удара о него
    const blocked = cached.current.blocked
    const touch = blocked ?? cached.current.touch
    ring.visible = Boolean(touch && (cfg.ring || blocked))
    if (touch) {
      ring.position.set(touch.x, 0.014, toSceneZ(touch.y))
      const mat = ring.material as THREE.MeshBasicMaterial
      mat.color.set(blocked ? '#ff7a5c' : '#ffd166')
    }
  })

  return (
    <group>
      <instancedMesh ref={dotsRef} args={[undefined, undefined, DOTS]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#fff4d0" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </instancedMesh>

      {/* жёлтое кольцо на выбранной тапом цели */}
      <mesh ref={targetRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[PHYSICS.asykRadius * 1.6, PHYSICS.asykRadius * 2.15, 28]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.8} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* кольцо первого касания земли */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.1, 0.135, 28]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.8} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* стрелка направления: древко, наконечник и бегущие шевроны */}
      <group ref={arrowRef} visible={false}>
        <mesh position={[0, 0.012, -ARROW_LENGTH / 2 + 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.055, ARROW_LENGTH - 0.2]} />
          <meshBasicMaterial color="#ffe9a8" transparent opacity={0.6} toneMapped={false} depthWrite={false} />
        </mesh>

        <mesh position={[0, 0.013, -ARROW_LENGTH]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.13, 0.32, 3]} />
          <meshBasicMaterial color="#ffd166" transparent opacity={0.75} toneMapped={false} depthWrite={false} />
        </mesh>

        <group ref={chevronsRef}>
          {Array.from({ length: CHEVRONS }, (_, i) => (
            <mesh key={i} position={[0, 0.014, -0.4]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.085, 0.16, 3]} />
              <meshBasicMaterial color="#fff6da" transparent opacity={0} toneMapped={false} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}
