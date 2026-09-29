import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playbackTimeScale } from '@/game/playback'
import { toSceneZ } from '@/game/scene/coords'
import { onFx } from './bus'

const MAX = 4
const LIFE = 0.55

/** Светлое кольцо по земле в точке удара. Гаснет за полсекунды. */
export function Shockwave() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const slots = useMemo(
    () => Array.from({ length: MAX }, () => ({ x: 0, y: 0, power: 1, life: 0 })),
    [],
  )
  const cursor = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useEffect(
    () =>
      onFx((e) => {
        if (e.t !== 'shockwave') return
        const s = slots[cursor.current % MAX]!
        cursor.current++
        s.x = e.x
        s.y = e.y
        s.power = e.power
        s.life = LIFE
      }),
    [slots],
  )

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05) * playbackTimeScale()
    let visible = 0

    for (let i = 0; i < MAX; i++) {
      const s = slots[i]!
      if (s.life > 0) {
        s.life = Math.max(0, s.life - dt)
        visible++
      }
      const k = s.life / LIFE
      // кольцо расширяется и тает
      const radius = (1 - k) * (0.5 + s.power * 0.9)
      dummy.position.set(s.x, 0.02, toSceneZ(s.y))
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.scale.setScalar(s.life > 0 ? radius : 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true

    const mat = mesh.material as THREE.MeshBasicMaterial
    const strongest = Math.max(...slots.map((s) => s.life / LIFE))
    mat.opacity = visible > 0 ? strongest * 0.55 : 0
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <ringGeometry args={[0.72, 1, 36]} />
      <meshBasicMaterial
        color="#fff3cf"
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  )
}
