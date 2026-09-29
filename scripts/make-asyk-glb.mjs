/**
 * Генератор модели асыка: scripts/make-asyk-glb.mjs -> public/models/asyk.glb
 *
 * Это ЗАГЛУШКА приличного качества, а не скан настоящей кости. Форма собрана
 * параметрически: вытянутое тело с двумя утолщениями по краям, талией посередине,
 * выпуклой стороной (бүк) и вогнутой (шік). Если положить в public/models свой
 * asyk.glb, игра подхватит его автоматически — код загрузки не изменится.
 *
 * Запуск: node scripts/make-asyk-glb.mjs
 */
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { writeFileSync } from 'node:fs'

// GLTFExporter читает итоговый Blob через FileReader, которого в Node нет
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf
        this.onloadend?.()
      })
    }
  }
}

const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2))

/** Радиус-вектор поверхности для направления на единичной сфере. */
function deform(v) {
  const p = v.clone()

  // базовые полуразмеры: вытянут по X, тонкий по Y, средний по Z
  p.x *= 1.0
  p.y *= 0.46
  p.z *= 0.62

  // две доли по краям и талия посередине
  const lobe = 1 + 0.2 * gauss(Math.abs(v.x), 0.8, 0.36) - 0.13 * gauss(v.x, 0, 0.44)
  p.y *= lobe
  p.z *= lobe

  // бүк: выпуклая сторона (+Z)
  if (v.z > 0) p.z += 0.11 * v.z * v.z * gauss(v.x, 0, 0.75)
  // шік: вогнутая сторона (−Z), ложбинка в середине
  if (v.z < 0) p.z += 0.15 * v.z * v.z * gauss(v.x, 0, 0.5) * gauss(v.y, 0, 0.7)

  // алшы/тәйкі: узкие грани чуть приплюснуты, чтобы кость уверенно стояла
  p.y *= 1 - 0.13 * gauss(Math.abs(v.y), 1, 0.42) * gauss(v.x, 0, 0.9)

  // лёгкая асимметрия — кость не идеально симметрична
  p.y += 0.035 * v.x * v.z
  p.z += 0.02 * v.x * v.y

  return p
}

function buildGeometry() {
  let g = new THREE.IcosahedronGeometry(1, 8)
  const pos = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const d = deform(v)
    pos.setXYZ(i, d.x, d.y, d.z)
  }
  g = mergeVertices(g, 1e-5)
  g.computeVertexNormals()

  // нормируем: длина по X = 1, центр в нуле, низ на y = 0 не делаем —
  // центр масс в начале координат удобнее для вращения в игре
  g.computeBoundingBox()
  const size = new THREE.Vector3()
  g.boundingBox.getSize(size)
  g.scale(1 / size.x, 1 / size.x, 1 / size.x)
  g.center()
  return g
}

const geometry = buildGeometry()
const material = new THREE.MeshStandardMaterial({
  name: 'asyk_bone',
  color: 0xe9dcc0,
  roughness: 0.68,
  metalness: 0.0,
})
const mesh = new THREE.Mesh(geometry, material)
mesh.name = 'asyk'

const scene = new THREE.Scene()
scene.name = 'asyk_root'
scene.add(mesh)

const exporter = new GLTFExporter()
exporter.parse(
  scene,
  (result) => {
    writeFileSync('public/models/asyk.glb', Buffer.from(result))
    const tri = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3
    console.log(`asyk.glb записан: ${tri} треугольников, ${geometry.attributes.position.count} вершин`)
  },
  (err) => {
    console.error('экспорт не удался:', err)
    process.exit(1)
  },
  { binary: true, onlyVisible: false },
)
