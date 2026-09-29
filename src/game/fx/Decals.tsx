import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PHYSICS } from '@/physics'
import { onFx } from './bus'
import { toSceneZ } from '@/game/scene/coords'

const MAX = 10
const LIFE = 4.5

/** Отпечатки сақа на песке, растворяются через несколько секунд. */
export function Decals() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const slots = useMemo(
    () => Array.from({ length: MAX }, () => ({ x: 0, y: 0, size: 1, life: 0 })),
    [],
  )
  const cursor = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])

  useEffect(
    () =>
      onFx((e) => {
        if (e.t !== 'decal') return
        const s = slots[cursor.current % MAX]!
        cursor.current++
        s.x = e.x
        s.y = e.y
        s.size = e.size
        s.life = LIFE
      }),
    [slots],
  )

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < MAX; i++) {
      const s = slots[i]!
      if (s.life > 0) s.life = Math.max(0, s.life - delta)
      const k = s.life / LIFE
      dummy.position.set(s.x, 0.003, toSceneZ(s.y))
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.scale.setScalar(k > 0 ? PHYSICS.sakaRadius * 1.9 * s.size : 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.setRGB(0.18, 0.12, 0.05).multiplyScalar(1)
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.opacity = 0.28
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <circleGeometry args={[1, 18]} />
      <meshBasicMaterial transparent opacity={0.28} depthWrite={false} />
    </instancedMesh>
  )
}
