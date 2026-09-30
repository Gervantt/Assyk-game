// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: src/physics/field.ts
import type { Field } from './types.ts'

/** Находится ли центр тела внутри кона. */
export function fieldContains(f: Field, x: number, y: number): boolean {
  const dx = x - f.cx
  const dy = y - f.cy
  if (f.shape === 'circle') return dx * dx + dy * dy <= f.radius * f.radius
  const ax = dx < 0 ? -dx : dx
  const ay = dy < 0 ? -dy : dy
  return ax <= f.radius && ay <= f.radius
}
