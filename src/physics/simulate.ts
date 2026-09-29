import { PHYSICS } from './config'
import { fieldContains } from './field'
import { length, quantize } from './math'
import { rngIntAt } from './rng'
import { isSettled, stepWorld } from './step'
import { cloneWorld } from './world'
import {
  BODY_SAKA,
  type Frame,
  type FrameBody,
  type SimEvent,
  type SimResult,
  type ThrowInput,
  type WorldState,
} from './types'

/**
 * Чистая функция броска. Один и тот же (state, input) всегда даёт
 * один и тот же finalState, frames и events — в браузере, в Node и в Edge Function.
 */
export function simulate(state: WorldState, input: ThrowInput): SimResult {
  const s = cloneWorld(state)
  const events: SimEvent[] = []
  const frames: Frame[] = []

  // сақа возвращается на линию броска и получает квантованную скорость
  const saka = s.bodies.find((b) => b.kind === BODY_SAKA)
  if (!saka) throw new Error('simulate: в мире нет сақа')
  saka.x = quantize(input.originX)
  saka.y = quantize(input.originY)
  saka.vx = quantize(input.vx)
  saka.vy = quantize(input.vy)
  saka.removed = false
  saka.outOfField = !fieldContains(s.field, saka.x, saka.y)
  saka.spin = 0

  const launchSpeed = length(saka.vx, saka.vy)
  const arc = launchSpeed / PHYSICS.maxSpeed

  // запомним, кто двигался — им в конце переназначим сторону падения
  const startX = s.bodies.map((b) => b.x)
  const startY = s.bodies.map((b) => b.y)

  s.tick = 0
  pushFrame(s, frames, arc)

  let ticks = 0
  while (ticks < PHYSICS.maxTicks) {
    stepWorld(s, events)
    ticks++
    if (ticks % PHYSICS.frameEvery === 0) pushFrame(s, frames, arc)
    if (isSettled(s)) break
  }

  // финальный кадр всегда есть, даже если последний тик не попал в сетку
  if (frames[frames.length - 1]?.tick !== s.tick) pushFrame(s, frames, arc)

  // сторона падения для сдвинувшихся тел — только из seeded PRNG
  let cursor = s.rngCursor
  for (let i = 0; i < s.bodies.length; i++) {
    const b = s.bodies[i]!
    const moved = b.x !== startX[i] || b.y !== startY[i]
    if (!moved) continue
    b.side = rngIntAt(s.seed, cursor, 4)
    cursor++
  }
  s.rngCursor = cursor

  if (saka.removed) {
    events.push({ type: 'sakaLost', tick: s.tick })
  } else if (fieldContains(s.field, saka.x, saka.y)) {
    events.push({ type: 'sakaStoppedInside', tick: s.tick, x: saka.x, y: saka.y })
  }

  return { finalState: s, frames, events, ticks }
}

/** z — исключительно визуальная высота: параболическая дуга полёта сақа. */
function flightHeight(tick: number, arc: number): number {
  if (tick >= PHYSICS.flightTicks) return 0
  const u = tick / PHYSICS.flightTicks
  return PHYSICS.flightHeight * arc * 4 * u * (1 - u)
}

function pushFrame(s: WorldState, frames: Frame[], arc: number): void {
  const bodies: FrameBody[] = new Array(s.bodies.length)
  for (let i = 0; i < s.bodies.length; i++) {
    const b = s.bodies[i]!
    bodies[i] = {
      id: b.id,
      x: b.x,
      y: b.y,
      z: b.kind === BODY_SAKA ? flightHeight(s.tick, arc) : 0,
      angle: b.angle,
      removed: b.removed,
    }
  }
  frames.push({ tick: s.tick, bodies })
}
