import { PHYSICS } from './config'
import { clamp, length, quantize } from './math'
import type { ThrowInput } from './types'

/**
 * ЕДИНСТВЕННОЕ место, где направление и сила превращаются в скорость.
 * Вызывается один раз на клиенте бросающего; по сети уходит уже результат.
 */

export const AIM = {
  /** ниже этой доли максимума тяги бросок не засчитывается (мёртвая зона) */
  deadZone: 0.08,
} as const

export interface PullVector {
  /** вектор «оттягивания» в мировых координатах (противоположен направлению броска) */
  dx: number
  dy: number
  /** длина тяги, при которой достигается максимальная сила */
  maxPull: number
}

export interface AimState {
  /** единичное направление броска */
  dirX: number
  dirY: number
  /** сила 0..1 после мёртвой зоны */
  power: number
  active: boolean
}

/** Тяга (в мировых метрах) -> направление и нормированная сила. */
export function aimFromPull(pull: PullVector): AimState {
  const len = length(pull.dx, pull.dy)
  if (len <= 0) return { dirX: 0, dirY: 1, power: 0, active: false }
  const raw = clamp(len / pull.maxPull, 0, 1)
  const power = raw < AIM.deadZone ? 0 : (raw - AIM.deadZone) / (1 - AIM.deadZone)
  return { dirX: -pull.dx / len, dirY: -pull.dy / len, power, active: power > 0 }
}

/** Направление + сила -> квантованный ThrowInput. */
export function makeThrow(
  aim: AimState,
  origin: { x: number; y: number },
  maxPowerScale = 1,
): ThrowInput {
  const speed =
    (PHYSICS.minSpeed + (PHYSICS.maxSpeed - PHYSICS.minSpeed) * clamp(aim.power, 0, 1)) *
    maxPowerScale
  return {
    vx: quantize(aim.dirX * speed),
    vy: quantize(aim.dirY * speed),
    originX: quantize(origin.x),
    originY: quantize(origin.y),
  }
}

/**
 * Клавиатурное управление: угол в радианах -> направление.
 * Math.cos/sin допустимы здесь, потому что результат немедленно квантуется
 * и дальше по сети идут уже (vx, vy), а не угол.
 */
export function aimFromAngle(angleRad: number, power: number): AimState {
  const dx = Math.cos(angleRad)
  const dy = Math.sin(angleRad)
  return { dirX: quantize(dx), dirY: quantize(dy), power: clamp(power, 0, 1), active: power > 0 }
}

/**
 * Оценка дальности при текущей силе: v^2 / (2a) — замкнутая формула трения.
 * Нужна только для короткого пунктира прицела (≈20% пути), а не для предсказания.
 */
export function estimatedRange(power: number): number {
  const v = PHYSICS.minSpeed + (PHYSICS.maxSpeed - PHYSICS.minSpeed) * clamp(power, 0, 1)
  return (v * v) / (2 * PHYSICS.friction)
}
