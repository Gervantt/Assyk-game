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
  const light = { r: 218, g: 190, b: 134 }
  const dark = { r: 165, g: 125, b: 73 }
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

/**
 * Крашеная сақа: настоящая текстура, а не красный цвет поверх кости.
 *
 * Простое умножение материала на красный давало плоское пятно — светлая
 * кость почти без вариаций, и вся фактура терялась. Здесь краска ложится
 * НА кость: тёмные места кости остаются тёмными, по краям и на выступах
 * краска стёрта и кость проглядывает, плюс неровность мазка. Именно так
 * выглядит асық, покрашенный во дворе.
 */
export function paintedSaka(
  source: THREE.Texture | null,
  color: { r: number; g: number; b: number },
  seed = 4242,
): THREE.CanvasTexture {
  const base = (source?.image ?? null) as CanvasImageSource | null
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  const g = c.getContext('2d')!

  if (base) {
    g.drawImage(base as CanvasImageSource, 0, 0, SIZE, SIZE)
  } else {
    // модель не загрузилась — рисуем кость сами, иначе красить будет нечего
    g.fillStyle = '#e9dcc0'
    g.fillRect(0, 0, SIZE, SIZE)
  }

  const img = g.getImageData(0, 0, SIZE, SIZE)
  const a = img.data
  const wear = valueNoise(seed, 12)
  const grain = valueNoise(seed + 77, 48)

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4
      // яркость кости: она задаёт светотень, краска её не стирает
      const lum = (a[i]! * 0.299 + a[i + 1]! * 0.587 + a[i + 2]! * 0.114) / 255

      // где краска сошла: пятнами и с мелким зерном
      const w = wear(x / SIZE, y / SIZE)
      const n = grain(x / SIZE, y / SIZE)
      let cover = 0.95 - (w > 0.72 ? (w - 0.72) * 1.7 : 0) - n * 0.1
      if (cover < 0) cover = 0
      if (cover > 1) cover = 1

      // краска неоднородна по густоте — мазок кистью
      const thick = 0.82 + n * 0.32

      const paintR = color.r * thick
      const paintG = color.g * thick
      const paintB = color.b * thick

      // кость под краской: сохраняем её светотень
      const shade = 0.55 + lum * 0.7

      a[i] = Math.min(255, (paintR * cover + a[i]! * (1 - cover)) * shade)
      a[i + 1] = Math.min(255, (paintG * cover + a[i + 1]! * (1 - cover)) * shade)
      a[i + 2] = Math.min(255, (paintB * cover + a[i + 2]! * (1 - cover)) * shade)
    }
  }
  g.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  // glTF кладёт текстуры с flipY = false, а CanvasTexture по умолчанию true.
  // Без копирования настроек выборка уезжает в пустую часть атласа — сақа
  // получалась белой.
  if (source) {
    tex.flipY = source.flipY
    tex.wrapS = source.wrapS
    tex.wrapT = source.wrapT
    tex.offset.copy(source.offset)
    tex.repeat.copy(source.repeat)
    tex.center.copy(source.center)
    tex.rotation = source.rotation
    tex.channel = source.channel
  } else {
    tex.flipY = false
  }
  tex.needsUpdate = true
  return tex
}

/** '#c33a25' -> {r,g,b} */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = parseInt(hex.replace('#', ''), 16)
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
}
