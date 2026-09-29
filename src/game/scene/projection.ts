import * as THREE from 'three'

/**
 * Мост между сценой и DOM-слоем управления: позволяет узнать, где сақа
 * на экране, и во что игрок ткнул пальцем на земле.
 *
 * Камера живёт внутри Canvas, а обработчики указателя — снаружи,
 * поэтому ссылку на неё держим здесь.
 */
let camera: THREE.Camera | null = null
let viewport = { width: 1, height: 1, left: 0, top: 0 }

export function setProjectionSource(
  cam: THREE.Camera,
  size: { width: number; height: number },
  rect: { left: number; top: number },
): void {
  camera = cam
  viewport = { width: size.width, height: size.height, left: rect.left, top: rect.top }
}

const v = new THREE.Vector3()

/** Мировая точка (координаты физики + высота) -> позиция на экране в px. */
export function worldToScreen(x: number, y: number, z = 0): { x: number; y: number } | null {
  if (!camera) return null
  v.set(x, z, -y).project(camera)
  return {
    x: viewport.left + (v.x * 0.5 + 0.5) * viewport.width,
    y: viewport.top + (-v.y * 0.5 + 0.5) * viewport.height,
  }
}

const raycaster = new THREE.Raycaster()
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const pointer = new THREE.Vector2()
const hit = new THREE.Vector3()

/** Точка на экране -> точка на плоскости земли в координатах физики. */
export function screenToGround(px: number, py: number): { x: number; y: number } | null {
  if (!camera) return null
  pointer.set(
    ((px - viewport.left) / viewport.width) * 2 - 1,
    -(((py - viewport.top) / viewport.height) * 2 - 1),
  )
  raycaster.setFromCamera(pointer, camera)
  const point = raycaster.ray.intersectPlane(ground, hit)
  if (!point) return null
  return { x: point.x, y: -point.z }
}
