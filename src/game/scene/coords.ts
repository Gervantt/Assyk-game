import { PHYSICS } from '@/physics'

/**
 * Физика двумерна: (x, y) — плоскость земли, y растёт «от игрока».
 * Сцена трёхмерна: X вправо, Y вверх, Z на зрителя. Отсюда y -> -z.
 */
export function toSceneX(x: number): number {
  return x
}

export function toSceneZ(y: number): number {
  return -y
}

/** Длительность одного кадра анимации в секундах. */
export const FRAME_DT = PHYSICS.dt * PHYSICS.frameEvery
