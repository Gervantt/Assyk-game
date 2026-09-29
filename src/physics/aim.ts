import { PHYSICS } from './config'
import { clamp, length, quantize } from './math'
import { surfaceAt } from './surfaces'
import type { ThrowInput } from './types'

/**
 * ЕДИНСТВЕННОЕ место, где прицел превращается в скорость.
 * Вызывается один раз на клиенте бросающего; по сети уходит уже результат,
 * поэтому Math.cos/sin здесь допустимы — детерминизм обеспечивает квантование.
 */

export const AIM = {
  /** ниже этой доли максимума тяги бросок не засчитывается */
  deadZone: 0.08,
  /** предел поворота направления от центра кона, радианы (±35°) */
  maxYaw: 0.6108652381980153,
} as const

export interface AimState {
  /** единичное направление броска в плоскости земли */
  dirX: number
  dirY: number
  /** угол подъёма, радианы, 0..PHYSICS.maxElevation */
  elevation: number
  /** сила 0..1 после мёртвой зоны */
  power: number
  active: boolean
}

export const IDLE_AIM: AimState = { dirX: 0, dirY: 1, elevation: 0, power: 0, active: false }

/** Поворот направления: 0 — прямо на кон, положительный — вправо. */
export function directionFromYaw(yaw: number): { dirX: number; dirY: number } {
  const y = clamp(yaw, -AIM.maxYaw, AIM.maxYaw)
  return { dirX: Math.sin(y), dirY: Math.cos(y) }
}

export interface PullVector {
  /** тяга в экранных пикселях: dx вправо, dy вниз */
  dx: number
  dy: number
  /** длина тяги, при которой достигается максимальная сила */
  maxPull: number
}

/**
 * Натяжение рогатки. Длина тяги — сила, наклон тяги — угол подъёма:
 * тянешь назад почти горизонтально — низкий настильный бросок,
 * тянешь вниз — свеча. Направление задаётся отдельно (свайпом).
 */
export function aimFromPull(yaw: number, pull: PullVector): AimState {
  const len = length(pull.dx, pull.dy)
  const dir = directionFromYaw(yaw)
  if (len <= 0) return { ...IDLE_AIM, ...dir }

  const raw = clamp(len / pull.maxPull, 0, 1)
  const power = raw < AIM.deadZone ? 0 : (raw - AIM.deadZone) / (1 - AIM.deadZone)
  const vertical = clamp((pull.dy > 0 ? pull.dy : 0) / len, 0, 1)

  return {
    ...dir,
    elevation: PHYSICS.maxElevation * vertical,
    power,
    active: power > 0,
  }
}

/** Клавиатура и тесты: угол поворота, угол подъёма и сила напрямую. */
export function aimFromAngles(yaw: number, elevation: number, power: number): AimState {
  return {
    ...directionFromYaw(yaw),
    elevation: clamp(elevation, 0, PHYSICS.maxElevation),
    power: clamp(power, 0, 1),
    active: power > 0,
  }
}

/** Прицел -> квантованный ThrowInput. Дальше по сети идёт только это. */
export function makeThrow(
  aim: AimState,
  origin: { x: number; y: number },
  maxPowerScale = 1,
  spin = 0,
): ThrowInput {
  const speed =
    (PHYSICS.minSpeed + (PHYSICS.maxSpeed - PHYSICS.minSpeed) * clamp(aim.power, 0, 1)) *
    maxPowerScale
  const horizontal = speed * Math.cos(aim.elevation)
  return {
    vx: quantize(aim.dirX * horizontal),
    vy: quantize(aim.dirY * horizontal),
    vz: quantize(speed * Math.sin(aim.elevation)),
    spin: quantize(clamp(spin, -1, 1)),
    originX: quantize(origin.x),
    originY: quantize(origin.y),
  }
}

export interface TrajectoryPoint {
  x: number
  y: number
  z: number
}

export interface TrajectoryPreview {
  points: TrajectoryPoint[]
  /** точка первого касания земли — кольцо подсказки */
  firstTouch: TrajectoryPoint | null
  /** во что упрётся сақа: камень на пути обрывает дугу */
  blockedAt: TrajectoryPoint | null
}

/** Препятствие для подсказки: сфера с центром на высоте своего радиуса. */
export interface TrajectoryObstacle {
  x: number
  y: number
  z: number
  radius: number
}

/**
 * Подсказка траектории: тот же шаг и те же формулы, что в движке,
 * но БЕЗ столкновений с телами. Это честная дуга полёта, а не «предсказатель
 * результата»: как только сақа кого-то заденет, всё пойдёт иначе.
 */
export function predictTrajectory(
  input: ThrowInput,
  surfaceId: number,
  radius = PHYSICS.sakaRadius,
  seconds = 3,
  obstacles: TrajectoryObstacle[] = [],
): TrajectoryPreview {
  const dt = PHYSICS.dt
  const surface = surfaceAt(surfaceId)
  const drag = 1 - PHYSICS.airDrag * dt
  const slideDrop = surface.muSlide * PHYSICS.g * dt

  let x = input.originX
  let y = input.originY
  let z = radius
  let vx = input.vx
  let vy = input.vy
  let vz = input.vz
  let airborne = true

  const points: TrajectoryPoint[] = [{ x, y, z }]
  let firstTouch: TrajectoryPoint | null = null
  let blockedAt: TrajectoryPoint | null = null
  const steps = Math.floor(seconds / dt)

  for (let i = 0; i < steps; i++) {
    if (airborne) {
      vz -= PHYSICS.g * dt
      vx *= drag
      vy *= drag
      vz *= drag
    } else {
      const sp = length(vx, vy)
      if (sp - slideDrop <= PHYSICS.vSleep) break
      const k = (sp - slideDrop) / sp
      vx *= k
      vy *= k
    }
    x += vx * dt
    y += vy * dt
    z += vz * dt

    if (airborne && z <= radius && vz < 0) {
      const impact = -vz
      z = radius
      vz = impact * surface.eGround
      const vT = length(vx, vy)
      if (vT > 0) {
        const dvT = surface.mu * (1 + surface.eGround) * impact
        const lost = dvT < vT ? dvT : vT
        const k = (vT - lost) / vT
        vx *= k
        vy *= k
      }
      if (!firstTouch) firstTouch = { x, y, z: 0 }
      if (vz < PHYSICS.vzSleep) {
        vz = 0
        airborne = false
      }
    }

    // дуга обрывается на препятствии: иначе подсказка обещала бы полёт,
    // которого не будет
    for (const o of obstacles) {
      const dx = x - o.x
      const dy = y - o.y
      const dz = z - o.z
      const rsum = radius + o.radius
      if (dx * dx + dy * dy + dz * dz < rsum * rsum) {
        blockedAt = { x, y, z }
        break
      }
    }
    if (blockedAt) {
      points.push({ x, y, z })
      break
    }

    if (i % 4 === 0) points.push({ x, y, z })
  }

  return { points, firstTouch, blockedAt }
}
