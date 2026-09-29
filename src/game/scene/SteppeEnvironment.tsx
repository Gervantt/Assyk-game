import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * HDRI степного неба, собранный кодом: равнопромежуточная панорама
 * (зенит — глубокая синева, горизонт — тёплая дымка, низ — песок, плюс диск солнца),
 * прогнанная через PMREM. Даёт материалам честные отражения и мягкий свет,
 * не таща в проект гигабайтный .hdr и не завися от CDN.
 */
function buildSkyTexture(): THREE.Texture {
  const w = 512
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#1d4d86')
  sky.addColorStop(0.34, '#5ea3d6')
  sky.addColorStop(0.49, '#d8dcc8')
  sky.addColorStop(0.51, '#b09262')
  sky.addColorStop(1, '#4d3a1f')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // солнце: мягкое пятно чуть выше горизонта
  const sunX = w * 0.68
  const sunY = h * 0.3
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.42)
  glow.addColorStop(0, 'rgba(255,246,214,1)')
  glow.addColorStop(0.12, 'rgba(255,230,170,0.75)')
  glow.addColorStop(1, 'rgba(255,220,150,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  const tex = new THREE.CanvasTexture(canvas)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function SteppeEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    pmrem.compileEquirectangularShader()
    const sky = buildSkyTexture()
    const target = pmrem.fromEquirectangular(sky)
    scene.environment = target.texture
    // та же панорама фоном: иначе за краем земли видна чёрная пустота
    scene.background = sky

    return () => {
      scene.environment = null
      scene.background = null
      target.dispose()
      sky.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  return null
}
