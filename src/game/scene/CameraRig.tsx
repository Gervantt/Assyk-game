import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleShake } from '@/game/fx/shake'
import { fovFor, frameCamera } from '@/game/camera/cameraDirector'
import { useGameStore } from '@/store/useGameStore'

/** Камера целиком подчиняется режиссёру; здесь только применение и тряска. */
export function CameraRig({
  throwLineY,
  fieldRadius,
}: {
  throwLineY: number
  fieldRadius: number
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const position = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const lastFov = useRef(0)

  useFrame((_, delta) => {
    const topView = useGameStore.getState().camera === 'top'
    frameCamera(topView, throwLineY, fieldRadius, Math.min(delta, 0.05), position, target)

    camera.position.copy(position)
    camera.lookAt(target)

    const shake = sampleShake(delta)
    if (shake.x !== 0 || shake.y !== 0) {
      camera.position.x += shake.x
      camera.position.y += shake.y
    }

    const fov = fovFor(size.width / Math.max(size.height, 1))
    if (fov !== lastFov.current) {
      lastFov.current = fov
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}
