import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

let camera: THREE.Camera | null = null
let canvas: HTMLCanvasElement | null = null

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hit = new THREE.Vector3()

export function AimRaycast() {
  const activeCamera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    camera = activeCamera
    canvas = gl.domElement
    return () => {
      if (camera === activeCamera && canvas === gl.domElement) {
        camera = null
        canvas = null
      }
    }
  }, [activeCamera, gl])

  return null
}

export function groundPointAt(clientX: number, clientY: number): THREE.Vector3 | null {
  if (!camera || !canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  return raycaster.ray.intersectPlane(ground, hit)?.clone() ?? null
}

export function projectWorldPoint(x: number, y: number, z: number): { x: number; y: number } | null {
  if (!camera || !canvas) return null
  const rect = canvas.getBoundingClientRect()
  const point = new THREE.Vector3(x, y, z).project(camera)
  if (point.z < -1 || point.z > 1) return null
  return {
    x: rect.left + ((point.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - point.y) / 2) * rect.height,
  }
}