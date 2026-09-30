import { useMemo } from 'react'
import * as THREE from 'three'
import { heightAt, reliefFor, type WorldState } from '@/physics'
import { groundTextures } from './textures'
import { useArenaLook } from '@/store/useShopStore'

/** Сколько метров вокруг кона показываем рельефом. */
const PATCH = 11
/** Сегментов по стороне. 96 хватает, чтобы бугры читались, и это дёшево. */
const SEGMENTS = 96

/**
 * Земля.
 *
 * Важно: видимые неровности — ТОТ ЖЕ рельеф, по которому считается физика.
 * Если рисовать ровный пол, а катить по буграм, интерфейс врёт игроку —
 * ровно та же ошибка, что была с хитбоксом камня.
 */
function reliefGeometry(world: WorldState): THREE.BufferGeometry {
  const relief = reliefFor(
    world.seed,
    world.reliefAmp ?? 0,
    world.bounds.halfWidth > world.bounds.halfHeight
      ? world.bounds.halfWidth
      : world.bounds.halfHeight,
  )
  const g = new THREE.PlaneGeometry(PATCH, PATCH, SEGMENTS, SEGMENTS)
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    // сцена смотрит на мир сверху: ось Z сцены — это Y мира
    const worldY = -pos.getZ(i)
    pos.setY(i, heightAt(relief, x, worldY))
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

export function Ground({ world }: { world: WorldState }) {
  const arena = useArenaLook()
  const { albedo, normal } = groundTextures(22)
  const normalScale = useMemo(() => new THREE.Vector2(0.32, 0.32), [])

  const geometry = useMemo(
    () => reliefGeometry(world),
    // рельеф зависит только от seed и амплитуды, пересобирать его на каждый
    // кадр незачем
    [world.seed, world.reliefAmp, world.bounds.halfWidth, world.bounds.halfHeight],
  )

  return (
    <group>
      {/* дальний план: ровная плоскость до горизонта */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial
          map={albedo}
          color={arena.ground}
          normalMap={normal}
          normalScale={normalScale}
          roughness={0.96}
          metalness={0}
        />
      </mesh>

      {/* игровая площадка: настоящий рельеф */}
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          map={albedo}
          color={arena.ground}
          normalMap={normal}
          normalScale={normalScale}
          roughness={0.96}
          metalness={0}
        />
      </mesh>
    </group>
  )
}
