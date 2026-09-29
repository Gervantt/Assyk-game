import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BODY_ASYK, BODY_SAKA, PHYSICS, type Frame, type WorldState } from '@/physics'
import { useGameStore } from '@/store/useGameStore'
import { FRAME_DT, toSceneZ } from './coords'

const ASYK_COLOR = '#f2e8d2'
const SAKA_COLOR = '#d4402a'

/** Геометрия асыка: сплюснутый капсулоид, лежащий на боку. */
function useAsykGeometry(radius: number) {
  return useMemo(() => {
    const g = new THREE.CapsuleGeometry(radius * 0.62, radius * 1.05, 4, 14)
    g.rotateZ(Math.PI / 2)
    g.scale(1, 0.62, 0.88)
    g.translate(0, radius * 0.38, 0)
    return g
  }, [radius])
}

interface Pose {
  x: number
  y: number
  z: number
  angle: number
  visible: boolean
}

/** Позы всех тел в момент времени t (сек) от начала броска. */
function poseAt(frames: Frame[], t: number, out: Map<number, Pose>): boolean {
  const last = frames[frames.length - 1]!
  const raw = t / FRAME_DT
  const i = Math.floor(raw)
  if (i >= frames.length - 1) {
    for (const b of last.bodies) out.set(b.id, { x: b.x, y: b.y, z: b.z, angle: b.angle, visible: !b.removed })
    return true
  }
  const a = frames[i]!
  const b = frames[i + 1]!
  const k = raw - i
  for (let n = 0; n < a.bodies.length; n++) {
    const pa = a.bodies[n]!
    const pb = b.bodies[n]!
    out.set(pa.id, {
      x: pa.x + (pb.x - pa.x) * k,
      y: pa.y + (pb.y - pa.y) * k,
      z: pa.z + (pb.z - pa.z) * k,
      angle: pa.angle + (pb.angle - pa.angle) * k,
      visible: !pa.removed,
    })
  }
  return false
}

function restPose(world: WorldState, out: Map<number, Pose>) {
  for (const b of world.bodies) {
    if (b.kind === BODY_SAKA) {
      // между бросками сақа всегда лежит на линии броска — игрок её подобрал
      out.set(b.id, { x: 0, y: world.throwLineY, z: 0, angle: b.angle, visible: true })
      continue
    }
    out.set(b.id, { x: b.x, y: b.y, z: 0, angle: b.angle, visible: !b.removed })
  }
}

/**
 * Рисует асыки (InstancedMesh) и сақа. Во время броска позиции берутся
 * из frames[] симуляции — никаких заранее заданных анимаций.
 */
export function Bodies({ world }: { world: WorldState }) {
  const asyks = useMemo(() => world.bodies.filter((b) => b.kind === BODY_ASYK), [world])
  const asykGeo = useAsykGeometry(PHYSICS.asykRadius)
  const sakaGeo = useAsykGeometry(PHYSICS.sakaRadius)
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const sakaRef = useRef<THREE.Mesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const poses = useMemo(() => new Map<number, Pose>(), [])

  useLayoutEffect(() => {
    restPose(world, poses)
  }, [world, poses])

  useFrame(() => {
    const { playback, phase, finishPlayback } = useGameStore.getState()

    if (phase === 'animating' && playback) {
      const t = (performance.now() - playback.startedAt) / 1000
      const done = poseAt(playback.frames, t, poses)
      if (done) finishPlayback()
    } else {
      restPose(world, poses)
    }

    const mesh = meshRef.current
    if (mesh) {
      asyks.forEach((b, i) => {
        const p = poses.get(b.id)
        if (!p) return
        dummy.position.set(p.x, p.z, toSceneZ(p.y))
        // асық лежит плашмя: крутим только вокруг вертикали, иначе он «встаёт на ребро»
        dummy.rotation.set(0, p.angle, 0)
        dummy.scale.setScalar(p.visible ? 1 : 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    const saka = sakaRef.current
    const sp = poses.get(0)
    if (saka && sp) {
      saka.position.set(sp.x, sp.z, toSceneZ(sp.y))
      saka.rotation.set(0, sp.angle, 0)
      saka.visible = sp.visible
    }
  })

  return (
    <group>
      <instancedMesh
        key={asyks.length}
        ref={meshRef}
        args={[asykGeo, undefined, Math.max(asyks.length, 1)]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={ASYK_COLOR} roughness={0.72} metalness={0.02} />
      </instancedMesh>

      <mesh ref={sakaRef} geometry={sakaGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color={SAKA_COLOR}
          roughness={0.45}
          metalness={0.15}
          emissive={SAKA_COLOR}
          emissiveIntensity={0.16}
        />
      </mesh>
    </group>
  )
}
