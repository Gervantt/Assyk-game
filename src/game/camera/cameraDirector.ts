import * as THREE from 'three'
import { PHYSICS } from '@/physics'
import { currentFrameIndex, getPlayback } from '@/game/playback'
import { toSceneZ } from '@/game/scene/coords'
import { useAimStore } from '@/store/useAimStore'
import { useGameStore } from '@/store/useGameStore'

/**
 * Режиссёр камеры. Камера не «следит за мячом» — она знает, что сейчас
 * происходит, и выбирает ракурс под это: прицеливание, натяжение, полёт,
 * итог. Переходы плавные, поэтому смена состояния не дёргает картинку.
 */
export type CameraState = 'aimDirection' | 'aimPull' | 'flight' | 'result' | 'top'

interface Shot {
  /** высота камеры над землёй, м */
  height: number
  /** удаление от точки интереса, м */
  distance: number
  /**
   * Доворот вокруг точки интереса от направления броска, радианы.
   * Отрицательный знак ставит сақа в левую треть кадра, а кон — в правую,
   * как в Angry Birds: профиль дуги читается слева направо.
   */
  orbit: number
  /** время сглаживания, с */
  damp: number
}

const SHOTS: Record<CameraState, Shot> = {
  /** за спиной игрока: кон впереди, читается направление */
  aimDirection: { height: 2.2, distance: 4.4, orbit: 0, damp: 0.45 },
  /** облёт на три четверти сбоку: профиль дуги читается как в Angry Birds */
  aimPull: { height: 2.5, distance: 5.4, orbit: -0.75, damp: 0.5 },
  /** сопровождение сбоку */
  flight: { height: 2.6, distance: 5.0, orbit: -0.75, damp: 0.35 },
  /** подъём над коном: видно, что и куда легло */
  result: { height: 5.6, distance: 2.8, orbit: -0.3, damp: 0.6 },
  /** почти вертикально — режим прицеливания «вид сверху» */
  top: { height: 8.2, distance: 0.9, orbit: 0, damp: 0.5 },
}

const state = {
  current: 'aimDirection' as CameraState,
  /** точка интереса, к которой привязан кадр */
  target: new THREE.Vector3(0, 0, 0),
  position: new THREE.Vector3(0, 3, 6),
  initialised: false,
}

export function cameraState(): CameraState {
  return state.current
}

export function setCameraState(next: CameraState): void {
  state.current = next
}

/** Выбирает состояние по фазе игры и жесту. «Вид сверху» имеет приоритет. */
export function resolveCameraState(topView: boolean): CameraState {
  const phase = useGameStore.getState().phase
  if (phase === 'animating') return 'flight'
  if (phase === 'finished') return 'result'
  if (topView) return 'top'
  return useAimStore.getState().mode === 'pull' ? 'aimPull' : 'aimDirection'
}

const wantTarget = new THREE.Vector3()
const wantPosition = new THREE.Vector3()

/**
 * Считает желаемые позицию и точку взгляда. Возвращает их в переданные
 * векторы, чтобы не создавать мусор каждый кадр.
 */
export function frameCamera(
  topView: boolean,
  throwLineY: number,
  fieldRadius: number,
  delta: number,
  outPosition: THREE.Vector3,
  outTarget: THREE.Vector3,
): void {
  const next = resolveCameraState(topView)
  state.current = next
  const shot = SHOTS[next]
  const yaw = useAimStore.getState().yaw

  const playerZ = toSceneZ(throwLineY)
  // единичный вектор «от игрока к кону» с учётом доворота прицела
  const fx = Math.sin(yaw)
  const fz = -Math.cos(yaw)

  if (next === 'flight') {
    const pb = getPlayback()
    const saka = pb.frames[currentFrameIndex()]?.bodies[0]
    if (saka && !saka.removed) {
      // кадрируем так, чтобы в нём были и сақа, и кон
      wantTarget.set(saka.x * 0.6, Math.min(saka.z, 1.4) * 0.5, toSceneZ(saka.y) * 0.6)
    } else {
      wantTarget.set(0, 0, 0)
    }
  } else if (next === 'aimPull') {
    // ровно посередине между сақа и коном: в кадре и замах, и цель
    wantTarget.set(fx * fieldRadius * 0.3, 0.45, playerZ * 0.55 + fz * fieldRadius * 0.3)
  } else if (next === 'aimDirection') {
    wantTarget.set(fx * 1.2, 0.3, playerZ * 0.42 + fz * 1.2)
  } else {
    wantTarget.set(0, 0, 0)
  }

  // камера отходит и поднимается, когда сақа высоко
  let distance = shot.distance
  let height = shot.height
  if (next === 'flight') {
    const pb = getPlayback()
    const saka = pb.frames[currentFrameIndex()]?.bodies[0]
    const lift = saka && !saka.removed ? Math.min(saka.z, 3) : 0
    distance += lift * 0.55
    height += lift * 0.75
  }

  // позиция: отходим от точки интереса против направления броска,
  // довернув на orbit вокруг вертикали
  const cos = Math.cos(shot.orbit)
  const sin = Math.sin(shot.orbit)
  const bx = fx * cos - fz * sin
  const bz = fx * sin + fz * cos
  wantPosition.set(
    wantTarget.x - bx * distance,
    height,
    wantTarget.z - bz * distance,
  )

  // сглаживание, не зависящее от частоты кадров
  const k = 1 - Math.pow(0.001, delta / Math.max(shot.damp, 0.05))
  if (!state.initialised) {
    state.position.copy(wantPosition)
    state.target.copy(wantTarget)
    state.initialised = true
  } else {
    state.position.lerp(wantPosition, k)
    state.target.lerp(wantTarget, k)
  }

  outPosition.copy(state.position)
  outTarget.copy(state.target)
}

export function resetCamera(): void {
  state.initialised = false
  state.current = 'aimDirection'
}

/** Портрет — шире угол и камера дальше, иначе кон не помещается. */
export function fovFor(aspect: number): number {
  return aspect < 1 ? 55 : 45
}

export const CAMERA_DEBUG = { SHOTS, PHYSICS }
