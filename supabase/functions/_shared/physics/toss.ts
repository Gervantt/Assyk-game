// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: src/physics/toss.ts
import { PHYSICS, SIDE_RANK, SIDES, type SideName } from './config.ts'
import { quantize } from './math.ts'
import { rngAt } from './rng.ts'
import { surfaceAt } from './surfaces.ts'
import { STATE_AIR, STATE_RESTING } from './config.ts'

/**
 * Жеребьёвка: сақа подбрасывается ТОЙ ЖЕ физикой, что и в игре.
 * Небольшие отклонения берутся из seed матча, поэтому результат
 * воспроизводим и его можно проверить на другом клиенте.
 */
export interface TossResult {
  side: number
  name: SideName
  /** кадры подбрасывания — их можно проиграть в сцене */
  heights: number[]
}

const QUARTER = Math.PI / 2

export function tossSaka(seed: number, cursor: number): TossResult {
  const surface = surfaceAt(0)
  const dt = PHYSICS.dt
  const radius = PHYSICS.sakaRadius

  // отклонения из seed: высота подброса и закрутка
  const lift = quantize(3.4 + rngAt(seed, cursor) * 1.6)
  const spin = quantize(6 + rngAt(seed, cursor + 1) * 16)

  let z = radius
  let vz = lift
  let tumble = quantize(rngAt(seed, cursor + 2) * 6.283185307179586)
  let omega = spin
  let state: number = STATE_AIR
  const heights: number[] = []

  for (let i = 0; i < PHYSICS.maxTicks && state !== STATE_RESTING; i++) {
    vz -= PHYSICS.g * dt
    vz *= 1 - PHYSICS.airDrag * dt
    z += vz * dt
    tumble += omega * dt
    const damp = 1 - PHYSICS.omegaDamp * dt
    omega = damp > 0 ? omega * damp : 0

    if (z <= radius && vz < 0) {
      const impact = -vz
      z = radius
      vz = impact * surface.eGround
      if (vz < PHYSICS.vzSleep) {
        vz = 0
        state = STATE_RESTING
      }
    }
    if (i % PHYSICS.frameEvery === 0) heights.push(z)
  }

  const k = Math.round(tumble / QUARTER)
  const side = ((k % 4) + 4) % 4
  return { side, name: SIDES[side]!, heights }
}

/** Кто начинает: старшая выпавшая сторона (алшы > тәйкі > бүк > шік). */
export function drawFirstByToss(
  seed: number,
  playerCount: number,
): { first: number; tosses: TossResult[] } {
  const tosses: TossResult[] = []
  for (let i = 0; i < playerCount; i++) tosses.push(tossSaka(seed, 500 + i * 7))
  let first = 0
  for (let i = 1; i < playerCount; i++) {
    if (SIDE_RANK[tosses[i]!.side]! > SIDE_RANK[tosses[first]!.side]!) first = i
  }
  return { first, tosses }
}
