import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/useGameStore'
import { FRAME_DT, toSceneZ } from './coords'

/** Углы подъёма камеры: 2.5D «от игрока» и почти вертикальный «сверху». */
const VIEWS = {
  player: { elevationDeg: 55, distance: 7.9, targetZ: 1.0 },
  top: { elevationDeg: 78, distance: 7.2, targetZ: 0.7 },
} as const

function desiredPosition(view: keyof typeof VIEWS, target: THREE.Vector3, out: THREE.Vector3) {
  const v = VIEWS[view]
  const rad = (v.elevationDeg * Math.PI) / 180
  out.set(target.x, target.y + Math.sin(rad) * v.distance, target.z + Math.cos(rad) * v.distance)
}

/** Плавная камера: следит за сақа во время броска, переключается между видами. */
export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const target = useRef(new THREE.Vector3(0, 0, VIEWS.player.targetZ))
  const desired = useRef(new THREE.Vector3())
  const wanted = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    const { camera: view, phase, playback } = useGameStore.getState()
    const v = VIEWS[view]

    wanted.current.set(0, 0, v.targetZ)
    if (phase === 'animating' && playback) {
      // мягкий follow за сақа: смещаем цель, не теряя из виду кон
      const t = (performance.now() - playback.startedAt) / 1000
      const idx = Math.min(Math.floor(t / FRAME_DT), playback.frames.length - 1)
      const saka = playback.frames[idx]?.bodies[0]
      if (saka && !saka.removed) {
        wanted.current.x = saka.x * 0.35
        wanted.current.z = v.targetZ * 0.45 + toSceneZ(saka.y) * 0.4
      }
    }

    const k = 1 - Math.pow(0.0025, delta)
    target.current.lerp(wanted.current, k)
    desiredPosition(view, target.current, desired.current)
    camera.position.lerp(desired.current, k)
    camera.lookAt(target.current)
  })

  return null
}
