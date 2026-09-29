import {
  aimFromAngles,
  BODY_ASYK,
  DEFAULT_THROW_LINE_Y,
  makeThrow,
  simulate,
  type SimResult,
  type ThrowInput,
  type WorldState,
} from '@/physics'

export const ORIGIN = { x: 0, y: DEFAULT_THROW_LINE_Y }

/** yaw в радианах, угол подъёма в градусах, сила 0..1. */
export function shot(yaw: number, elevationDeg: number, power: number): ThrowInput {
  return makeThrow(aimFromAngles(yaw, (elevationDeg * Math.PI) / 180, power), ORIGIN)
}

export interface Outcome {
  knocked: number
  hit: boolean
  insideAfter: boolean
  lost: boolean
  sim: SimResult
}

export function outcomeOf(world: WorldState, input: ThrowInput): Outcome {
  const sim = simulate(world, input)
  return {
    knocked: sim.finalState.bodies.filter((b) => b.kind === BODY_ASYK && b.outOfField).length,
    hit: sim.events.some((e) => e.type === 'bodyHit'),
    insideAfter: sim.events.some((e) => e.type === 'sakaRest' && e.inside),
    lost: sim.events.some((e) => e.type === 'sakaLost'),
    sim,
  }
}

/**
 * Ищет бросок по сетке параметров. Тесты правил опираются на это, а не на
 * магические числа: после любой перенастройки физики они сами найдут
 * подходящий бросок и продолжат проверять ПРАВИЛО, а не координаты.
 */
export function findThrow(
  makeWorld: () => WorldState,
  accept: (o: Outcome) => boolean,
): ThrowInput {
  for (let yi = 0; yi <= 16; yi++) {
    const yaw = -0.24 + yi * 0.03
    for (const deg of [5, 8, 12, 16, 22, 28, 36, 45]) {
      for (let pi = 0; pi <= 10; pi++) {
        const power = 0.25 + pi * 0.075
        const input = shot(yaw, deg, power)
        if (accept(outcomeOf(makeWorld(), input))) return input
      }
    }
  }
  throw new Error('не нашлось броска, удовлетворяющего условию')
}
