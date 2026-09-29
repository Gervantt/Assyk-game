import * as THREE from 'three'

/**
 * Запасная форма асыка на случай, если модель не загрузилась.
 * Сплюснутый капсулоид: играть можно, просто выглядит проще.
 */
export function proceduralAsyk(): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(0.31, 0.44, 4, 16)
  g.rotateZ(Math.PI / 2)
  g.scale(1, 0.62, 0.88)
  return normalizeAsyk(g)
}

/**
 * Приводит любую модель асыка к единому виду: наибольший габарит = 1,
 * центр в начале координат. Высоту подъёма над землёй сцена считает сама,
 * потому что она зависит от того, какой стороной асық лёг.
 * Благодаря этому игре всё равно, чья модель лежит в public/models.
 */
export function normalizeAsyk(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.clone()
  g.computeBoundingBox()
  const box = g.boundingBox!
  const size = new THREE.Vector3()
  box.getSize(size)
  const longest = Math.max(size.x, size.y, size.z)
  if (longest > 0) g.scale(1 / longest, 1 / longest, 1 / longest)

  g.computeBoundingBox()
  const b = g.boundingBox!
  const c = new THREE.Vector3()
  b.getCenter(c)
  g.translate(-c.x, -c.y, -c.z)
  g.computeVertexNormals()
  return g
}
