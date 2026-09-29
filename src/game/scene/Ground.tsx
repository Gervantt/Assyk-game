import { useMemo } from 'react'
import * as THREE from 'three'

/** Земля: запечённый градиент песка вместо текстуры — быстро и без загрузок. */
export function Ground() {
  const texture = useMemo(() => {
    const size = 256
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.62)
    g.addColorStop(0, '#c9a86d')
    g.addColorStop(0.55, '#a8874f')
    g.addColorStop(1, '#5e4726')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    // крупицы песка — статический шум, одинаковый при каждом запуске не важен
    ctx.globalAlpha = 0.22
    for (let i = 0; i < 2600; i++) {
      const x = ((i * 9301 + 49297) % 233280) / 233280
      const y = ((i * 4021 + 12345) % 233280) / 233280
      ctx.fillStyle = i % 3 === 0 ? '#7a5f30' : '#efdcb4'
      ctx.fillRect(x * size, y * size, 1.4, 1.4)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
    </mesh>
  )
}
