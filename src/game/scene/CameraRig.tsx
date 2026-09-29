import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { currentFrameIndex, getPlayback, playbackTimeScale } from '@/game/playback'
import { sampleShake } from '@/game/fx/shake'
import { useGameStore } from '@/store/useGameStore'
import { toSceneZ } from './coords'

/** Углы подъёма камеры: 2.5D «от игрока» и почти вертикальный «сверху». */
const VIEWS = {
  player: { elevationDeg: 55, distance: 7.9, targetZ: 1.0 },
  top: { elevationDeg: 78, distance: 7.2, targetZ: 0.7 },
} as const

/** Насколько ближе подъезжает камера во время замедления на комбо. */
const SLOWMO_ZOOM = 0.72

function desiredPosition(
  view: keyof typeof VIEWS,
  distance: number,
  target: THREE.Vector3,
  out: THREE.Vector3,
) {
  const rad = (VIEWS[view].elevationDeg * Math.PI) / 180
  out.set(target.x, target.y + Math.sin(rad) * distance, target.z + Math.cos(rad) * distance)
}

/** Плавная камера: следит за сақа, наезжает на слоумо, трясётся от ударов. */
export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const target = useRef(new THREE.Vector3(0, 0, VIEWS.player.targetZ))
  const desired = useRef(new THREE.Vector3())
  const wanted = useRef(new THREE.Vector3())
  const zoom = useRef(1)

  useFrame((_, delta) => {
    const { camera: view, phase } = useGameStore.getState()
    const v = VIEWS[view]
    const pb = getPlayback()

    wanted.current.set(0, 0, v.targetZ)
    if (phase === 'animating' && pb.active && pb.frames.length > 0) {
      // мягкий follow за сақа: смещаем цель, не теряя из виду кон
      const saka = pb.frames[currentFrameIndex()]?.bodies[0]
      if (saka && !saka.removed) {
        wanted.current.x = saka.x * 0.35
        wanted.current.z = v.targetZ * 0.45 + toSceneZ(saka.y) * 0.4
      }
    }

    const slowMo = playbackTimeScale() < 1
    const zoomTarget = slowMo ? SLOWMO_ZOOM : 1
    zoom.current += (zoomTarget - zoom.current) * Math.min(1, delta * (slowMo ? 7 : 3))

    const k = 1 - Math.pow(0.0025, delta)
    target.current.lerp(wanted.current, k)
    desiredPosition(view, v.distance * zoom.current, target.current, desired.current)
    camera.position.lerp(desired.current, k)
    camera.lookAt(target.current)

    const shake = sampleShake(delta)
    if (shake.x !== 0 || shake.y !== 0) {
      camera.position.x += shake.x
      camera.position.y += shake.y
    }
  })

  return null
}
