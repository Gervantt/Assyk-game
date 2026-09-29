import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from '@/physics'
import { onFx } from './bus'
import { playbackTimeScale } from '@/game/playback'
import { toSceneZ } from '@/game/scene/coords'

const MAX = 130
const GRAVITY = -5.2

interface P {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  size: number
  r: number
  g: number
  b: number
}

/** Искры от удара и пыль от приземления. Один InstancedMesh — один draw call. */
export function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const pool = useMemo<P[]>(
    () =>
      Array.from({ length: MAX }, () => ({
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0, r: 1, g: 1, b: 1,
      })),
    [],
  )
  const cursor = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const rnd = useMemo(() => mulberry32(0xc0ffee), [])

  useEffect(() => {
    const spawn = (
      n: number,
      x: number,
      y: number,
      speed: number,
      up: number,
      life: number,
      size: number,
      rgb: [number, number, number],
    ) => {
      for (let i = 0; i < n; i++) {
        const p = pool[cursor.current % MAX]!
        cursor.current++
        const a = rnd() * Math.PI * 2
        const s = speed * (0.35 + rnd() * 0.65)
        p.x = x
        p.y = y
        p.z = 0.015 + rnd() * 0.03
        p.vx = Math.cos(a) * s
        p.vy = Math.sin(a) * s
        p.vz = up * (0.45 + rnd() * 0.85)
        p.max = life * (0.7 + rnd() * 0.6)
        p.life = p.max
        p.size = size * (0.6 + rnd() * 0.8)
        p.r = rgb[0]
        p.g = rgb[1]
        p.b = rgb[2]
      }
    }

    return onFx((e) => {
      if (e.t === 'sparks') {
        spawn(6 + Math.round(e.power * 10), e.x, e.y, 1.5 + e.power * 2.6, 1.1 + e.power, 0.42, 0.028, [1, 0.88, 0.56])
      } else if (e.t === 'dust') {
        spawn(8 + Math.round(e.power * 12), e.x, e.y, 0.5 + e.power * 1.1, 0.5, 0.75, 0.05, [0.83, 0.71, 0.5])
      }
    })
  }, [pool, rnd])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05) * playbackTimeScale()

    for (let i = 0; i < MAX; i++) {
      const p = pool[i]!
      if (p.life > 0) {
        p.life -= dt
        p.vz += GRAVITY * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        if (p.z < 0.005) {
          p.z = 0.005
          p.vz = 0
          p.vx *= 0.72
          p.vy *= 0.72
        }
      }
      const k = p.life > 0 ? p.life / p.max : 0
      dummy.position.set(p.x, p.z, toSceneZ(p.y))
      dummy.scale.setScalar(p.size * k)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.setRGB(p.r, p.g, p.b).multiplyScalar(0.35 + k * 0.65)
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.92} />
    </instancedMesh>
  )
}
