import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BODY_ASYK, BODY_SAKA, BODY_STONE, PHYSICS, type Frame, type WorldState } from '@/physics'
import { useAsykModel } from '@/game/assets/useAsykModel'
import { useSakaLook } from '@/store/useShopStore'
import { FRAME_DT, getPlayback } from '@/game/playback'
import { useGameStore } from '@/store/useGameStore'
import { toSceneZ } from './coords'

const ASYK_COLOR = '#efe3c6'
/** Запасной цвет сақа, если скин почему-то не прочитался. */
const SAKA_COLOR = '#c33a25'
/** Длина модели относительно радиуса коллайдера. */
const VISUAL_SCALE = 2.45

interface Pose {
  x: number
  y: number
  z: number
  tumble: number
  yaw: number
  side: number
  visible: boolean
}

/** Позы всех тел в момент времени t (сек) от начала броска. */
function poseFromFrames(frames: Frame[], t: number, sides: Map<number, number>, out: Map<number, Pose>) {
  const last = frames[frames.length - 1]!
  const raw = t / FRAME_DT
  const i = Math.floor(raw)
  if (i >= frames.length - 1) {
    for (const b of last.bodies) {
      out.set(b.id, { x: b.x, y: b.y, z: b.z, tumble: b.tumble, yaw: b.yaw, side: sides.get(b.id) ?? 0, visible: !b.removed })
    }
    return
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
      tumble: pa.tumble + (pb.tumble - pa.tumble) * k,
      yaw: pa.yaw + (pb.yaw - pa.yaw) * k,
      side: sides.get(pa.id) ?? 0,
      visible: !pa.removed,
    })
  }
}

function restPose(world: WorldState, out: Map<number, Pose>) {
  for (const b of world.bodies) {
    if (b.kind === BODY_SAKA) {
      // между бросками сақа всегда лежит на линии броска — игрок её подобрал
      out.set(b.id, { x: 0, y: world.throwLineY, z: b.radius, tumble: b.tumble, yaw: b.yaw, side: 0, visible: true })
      continue
    }
    out.set(b.id, { x: b.x, y: b.y, z: b.z, tumble: b.tumble, yaw: b.yaw, side: b.side, visible: !b.removed })
  }
}

/** Камни-препятствия. Неподвижны, поэтому матрицы считаются один раз. */
function Stones({ world }: { world: WorldState }) {
  const stones = useMemo(() => world.bodies.filter((b) => b.kind === BODY_STONE), [world])
  const ref = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh || stones.length === 0) return
    const dummy = new THREE.Object3D()
    stones.forEach((b, i) => {
      // Коллайдер камня — сфера радиуса b.radius с центром на высоте b.radius.
      // Меш обязан её повторять: раньше он был вдвое ниже, и сақа, визуально
      // перелетая валун, всё равно билась о невидимую верхушку.
      dummy.position.set(b.x, b.radius, toSceneZ(b.y))
      dummy.rotation.set(0, b.id * 1.1, 0)
      dummy.scale.set(b.radius * 1.04, b.radius * 0.98, b.radius * 1.04)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [stones])

  if (stones.length === 0) return null
  return (
    <instancedMesh
      key={stones.length}
      ref={ref}
      args={[undefined, undefined, stones.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#6f6558" roughness={0.92} metalness={0.03} flatShading />
    </instancedMesh>
  )
}

/**
 * Асыки (InstancedMesh) и сақа — один и тот же меш из public/models/asyk.glb,
 * отличаются материалом и размером. Во время броска позиции берутся из
 * frames[] симуляции: заранее записанных анимаций нет.
 */
export function Bodies({ world }: { world: WorldState }) {
  const { geometry, map } = useAsykModel()
  const saka = useSakaLook()
  const asyks = useMemo(() => world.bodies.filter((b) => b.kind === BODY_ASYK), [world])
  const sides = useMemo(() => new Map(world.bodies.map((b) => [b.id, b.side])), [world])

  const meshRef = useRef<THREE.InstancedMesh>(null)
  const sakaRef = useRef<THREE.Mesh>(null)
  const shadowRef = useRef<THREE.Mesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const poses = useMemo(() => new Map<number, Pose>(), [])

  /** Lower the rendered mesh so it rests on the physics body's ground sphere. */
  const meshHalf = useMemo(() => {
    geometry.computeBoundingBox()
    const size = new THREE.Vector3()
    geometry.boundingBox!.getSize(size)
    return Math.min(size.x, size.y, size.z) / 2
  }, [geometry])

  useLayoutEffect(() => {
    restPose(world, poses)
  }, [world, poses])

  useFrame(() => {
    const phase = useGameStore.getState().phase
    const pb = getPlayback()

    if (phase === 'animating' && pb.active && pb.frames.length > 0) {
      poseFromFrames(pb.frames, pb.t, sides, poses)
    } else {
      restPose(world, poses)
    }

    const mesh = meshRef.current
    if (mesh) {
      const s = PHYSICS.asykRadius * VISUAL_SCALE
      const drop = PHYSICS.asykRadius - meshHalf * s
      asyks.forEach((b, i) => {
        const p = poses.get(b.id)
        if (!p) return
        dummy.position.set(p.x, p.z - drop, toSceneZ(p.y))
        dummy.rotation.set(p.tumble + (p.side * Math.PI) / 2, p.yaw, 0, 'YXZ')
        dummy.scale.setScalar(p.visible ? s : 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    const saka = sakaRef.current
    const sp = poses.get(0)
    if (saka && sp) {
      const s = PHYSICS.sakaRadius * VISUAL_SCALE
      const drop = PHYSICS.sakaRadius - meshHalf * s
      saka.position.set(sp.x, sp.z - drop, toSceneZ(sp.y))
      saka.rotation.set(sp.tumble, sp.yaw, 0, 'YXZ')
      saka.scale.setScalar(s)
      saka.visible = sp.visible
    }

    // тень-пятно под сақа: сжимается и светлеет, когда сақа в воздухе
    const blob = shadowRef.current
    if (blob && sp) {
      const k = Math.max(0, 1 - sp.z * 1.7)
      blob.position.set(sp.x, 0.004, toSceneZ(sp.y))
      blob.scale.setScalar(Math.max(0.35, k))
      const mat = blob.material as THREE.MeshBasicMaterial
      mat.opacity = sp.visible ? 0.3 * k : 0
    }
  })

  return (
    <group>
      <instancedMesh
        key={`${asyks.length}-${geometry.uuid}`}
        ref={meshRef}
        args={[geometry, undefined, Math.max(asyks.length, 1)]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <meshStandardMaterial map={map} color={map ? '#ffffff' : ASYK_COLOR} roughness={0.66} metalness={0.04} />
      </instancedMesh>

      <mesh ref={sakaRef} geometry={geometry} castShadow receiveShadow frustumCulled={false}>
        {/* Скин меняет ТОЛЬКО материал. Радиус, масса и всё остальное,
            что влияет на полёт, заданы в src/physics и от скина не зависят. */}
        <meshStandardMaterial
          map={map}
          color={saka.color ?? SAKA_COLOR}
          roughness={saka.roughness}
          metalness={saka.metalness}
          emissive={saka.emissive}
          emissiveIntensity={0.12}
        />
      </mesh>

      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[PHYSICS.sakaRadius * 1.5, 20]} />
        <meshBasicMaterial color="#2b1d0c" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      <Stones world={world} />
    </group>
  )
}
