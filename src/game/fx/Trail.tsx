import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PHYSICS } from '@/physics'
import { currentFrameIndex, getPlayback } from '@/game/playback'
import { useGameStore } from '@/store/useGameStore'
import { useTrailLook } from '@/store/useShopStore'
import { toSceneZ } from '@/game/scene/coords'

const SEGMENTS = 16

/** След за сақа в полёте: кольцевой буфер последних позиций. */
export function Trail() {
  const trail = useTrailLook()
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const buffer = useMemo(
    () => Array.from({ length: SEGMENTS }, () => new THREE.Vector3(0, -99, 0)),
    [],
  )
  const head = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const phase = useGameStore.getState().phase
    const pb = getPlayback()

    if (phase === 'animating' && pb.active && pb.frames.length > 0) {
      const saka = pb.frames[currentFrameIndex()]?.bodies[0]
      if (saka && !saka.removed) {
        head.current = (head.current + 1) % SEGMENTS
        buffer[head.current]!.set(saka.x, saka.z + PHYSICS.sakaRadius * 0.7, toSceneZ(saka.y))
      }
    } else {
      for (const v of buffer) v.set(0, -99, 0)
    }

    for (let i = 0; i < SEGMENTS; i++) {
      const idx = (head.current - i + SEGMENTS * 2) % SEGMENTS
      const v = buffer[idx]!
      const k = 1 - i / SEGMENTS
      dummy.position.copy(v)
      // ширина следа — часть скина: на траекторию она не влияет
      dummy.scale.setScalar(PHYSICS.sakaRadius * 0.85 * trail.width * k * k)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SEGMENTS]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial
        color={trail.color}
        transparent
        opacity={0.4}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  )
}
