import * as THREE from 'three'
import { mulberry32 } from '@/physics'

/**
 * Текстуры земли генерируются кодом: бесшовный песок и карта нормалей к нему.
 * Так в репозитории нет бинарных ассетов и вопросов с лицензиями,
 * а выглядит заметно живее сплошной заливки.
 */

const SIZE = 512

/** Бесшовный value-noise: решётка замыкается по модулю, поэтому шва нет. */
function valueNoise(seed: number, cells: number): (x: number, y: number) => number {
  const rnd = mulberry32(seed)
  const grid = new Float32Array(cells * cells)
  for (let i = 0; i < grid.length; i++) grid[i] = rnd()
  const at = (x: number, y: number) => grid[(((y % cells) + cells) % cells) * cells + (((x % cells) + cells) % cells)]!
  const smooth = (t: number) => t * t * (3 - 2 * t)

  return (x, y) => {
    const fx = x * cells
    const fy = y * cells
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = smooth(fx - x0)
    const ty = smooth(fy - y0)
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx
    return a + (b - a) * ty
  }
}

function heightField(): Float32Array {
  // упор на высокие частоты: нужен песок, а не пятна глины
  const octaves = [
    { n: valueNoise(101, 12), amp: 0.2 },
    { n: valueNoise(202, 32), amp: 0.24 },
    { n: valueNoise(303, 80), amp: 0.3 },
    { n: valueNoise(404, 192), amp: 0.26 },
  ]
  const h = new Float32Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE
      const v = y / SIZE
      let sum = 0
      for (const o of octaves) sum += o.n(u, v) * o.amp
      h[y * SIZE + x] = sum
    }
  }
  return h
}

let cache: { albedo: THREE.Texture; normal: THREE.Texture } | null = null

export function groundTextures(repeat = 22): { albedo: THREE.Texture; normal: THREE.Texture } {
  if (cache) return cache

  const h = heightField()
  const albedoCanvas = document.createElement('canvas')
  albedoCanvas.width = albedoCanvas.height = SIZE
  const ac = albedoCanvas.getContext('2d')!
  const aImg = ac.createImageData(SIZE, SIZE)

  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = normalCanvas.height = SIZE
  const nc = normalCanvas.getContext('2d')!
  const nImg = nc.createImageData(SIZE, SIZE)

  // песок: тёплый светлый по гребням, тёмный в ложбинах
  const light = { r: 202, g: 165, b: 108 }
  const dark = { r: 146, g: 106, b: 57 }
  const at = (x: number, y: number) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]!

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4
      const t = Math.min(1, Math.max(0, (at(x, y) - 0.32) / 0.36))
      aImg.data[i] = dark.r + (light.r - dark.r) * t
      aImg.data[i + 1] = dark.g + (light.g - dark.g) * t
      aImg.data[i + 2] = dark.b + (light.b - dark.b) * t
      aImg.data[i + 3] = 255

      // нормаль из конечных разностей высоты
      const dx = (at(x + 1, y) - at(x - 1, y)) * 7
      const dy = (at(x, y + 1) - at(x, y - 1)) * 7
      const len = Math.sqrt(dx * dx + dy * dy + 1)
      nImg.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      nImg.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      nImg.data[i + 2] = (1 / len) * 0.5 * 255 + 127
      nImg.data[i + 3] = 255
    }
  }

  ac.putImageData(aImg, 0, 0)
  nc.putImageData(nImg, 0, 0)

  const albedo = new THREE.CanvasTexture(albedoCanvas)
  albedo.colorSpace = THREE.SRGBColorSpace
  const normal = new THREE.CanvasTexture(normalCanvas)

  for (const tex of [albedo, normal]) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeat, repeat)
    tex.anisotropy = 8
  }

  cache = { albedo, normal }
  return cache
}
