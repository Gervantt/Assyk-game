// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: src/physics/hash.ts
import { PHYSICS } from './config.ts'
import type { WorldState } from './types.ts'

/**
 * FNV-1a поверх квантованных целых. Только целочисленные операции,
 * поэтому результат одинаков в любом движке JS.
 */
function fnv(h: number, v: number): number {
  return Math.imul(h ^ (v | 0), 16777619) >>> 0
}

function q(v: number): number {
  return Math.round(v / PHYSICS.quantum) | 0
}

/** Хеш состояния мира: позиции, скорости и флаги всех тел. */
export function stateHash(state: WorldState): string {
  let h = 2166136261 >>> 0
  h = fnv(h, state.bodies.length)
  h = fnv(h, state.rngCursor)
  h = fnv(h, state.movers.length)
  h = fnv(h, state.surfaceId)
  for (const b of state.bodies) {
    h = fnv(h, b.id)
    h = fnv(h, q(b.x))
    h = fnv(h, q(b.y))
    h = fnv(h, q(b.z))
    h = fnv(h, q(b.vx))
    h = fnv(h, q(b.vy))
    h = fnv(h, q(b.vz))
    h = fnv(h, b.side)
    h = fnv(h, b.state)
    h = fnv(h, (b.outOfField ? 1 : 0) + (b.removed ? 2 : 0) + (b.scored ? 4 : 0))
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
