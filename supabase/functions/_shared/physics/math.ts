// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: src/physics/math.ts
import { PHYSICS } from './config.ts'

/**
 * Квантование числа до сетки PHYSICS.quantum.
 * Math.round определён стандартом побитово точно (в отличие от sin/cos/atan),
 * поэтому его использование не ломает детерминизм между браузерами.
 */
export function quantize(v: number, step: number = PHYSICS.quantum): number {
  return Math.round(v / step) * step
}

/** Длина вектора. Math.sqrt — единственная разрешённая «сложная» операция. */
export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
