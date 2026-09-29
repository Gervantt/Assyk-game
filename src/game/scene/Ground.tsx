import { useMemo } from 'react'
import * as THREE from 'three'
import { groundTextures } from './textures'

/** Земля: песок с картой нормалей, сгенерированный кодом. */
export function Ground() {
  const { albedo, normal } = groundTextures(22)
  const normalScale = useMemo(() => new THREE.Vector2(0.32, 0.32), [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial
        map={albedo}
        normalMap={normal}
        normalScale={normalScale}
        roughness={0.96}
        metalness={0}
      />
    </mesh>
  )
}
