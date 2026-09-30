// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: src/physics/simulate.ts
import { PHYSICS, STATE_AIR } from './config.ts'
import { fieldContains } from './field.ts'
import { length, quantize } from './math.ts'
import { heightAt, reliefFor } from './relief.ts'
import { isSettled, stepWorld } from './step.ts'
import { cloneWorld } from './world.ts'
import {
  BODY_ASYK,
  BODY_SAKA,
  type Frame,
  type FrameBody,
  type SimEvent,
  type SimResult,
  type ThrowInput,
  type WorldState,
} from './types.ts'

/**
 * Чистая функция броска. Один и тот же (state, input) всегда даёт
 * один и тот же finalState, frames и events — в браузере, в Node и в Edge Function.
 *
 * Бросок просчитывается ЦЕЛИКОМ и только потом проигрывается рендером.
 * Благодаря этому режиссёр камеры и эффектов заранее знает, где и когда
 * будет удар, и успевает начать замедление ДО него.
 */
export function simulate(state: WorldState, input: ThrowInput): SimResult {
  const s = cloneWorld(state)
  const events: SimEvent[] = []
  const frames: Frame[] = []

  const saka = s.bodies.find((b) => b.kind === BODY_SAKA)
  if (!saka) throw new Error('simulate: в мире нет сақа')
  saka.x = quantize(input.originX)
  saka.y = quantize(input.originY)
  // бросок начинается с земли В ЭТОЙ ТОЧКЕ, а не с нулевой отметки:
  // пол неровный, и иначе сақа при броске подпрыгивала бы на ровном месте
  saka.z = quantize(
    heightAt(
      reliefFor(
        s.seed,
        s.reliefAmp ?? 0,
        s.bounds.halfWidth > s.bounds.halfHeight ? s.bounds.halfWidth : s.bounds.halfHeight,
      ),
      saka.x,
      saka.y,
    ) + saka.radius,
  )
  saka.vx = quantize(input.vx)
  saka.vy = quantize(input.vy)
  saka.vz = quantize(input.vz)
  saka.omega = quantize(input.spin) * PHYSICS.spinToOmega
  saka.removed = false
  saka.state = STATE_AIR
  saka.outOfField = !fieldContains(s.field, saka.x, saka.y)

  // минимальное расстояние от сақа до каждого асыка — для события «мимо впритирку»
  const asyks = s.bodies.filter((b) => b.kind === BODY_ASYK)
  const minDist = new Map<number, number>()
  for (const a of asyks) minDist.set(a.id, Number.POSITIVE_INFINITY)

  s.tick = 0
  pushFrame(s, frames)

  let ticks = 0
  while (ticks < PHYSICS.maxTicks) {
    stepWorld(s, events)
    ticks++
    trackProximity(saka, asyks, minDist)
    if (ticks % PHYSICS.frameEvery === 0) pushFrame(s, frames)
    if (isSettled(s)) break
  }

  if (frames[frames.length - 1]?.tick !== s.tick) pushFrame(s, frames)

  // Колеблющиеся асыки возвращаются в стартовую фазу: игрок между бросками
  // видит точку, из которой асық двинется в следующий раз.
  for (const m of s.movers) {
    const b = s.bodies[m.bodyId]
    if (!b || b.removed) continue
    b.x = m.axis === 0 ? m.baseX - m.amplitude : m.baseX
    b.y = m.axis === 1 ? m.baseY - m.amplitude : m.baseY
    b.vx = 0
    b.vy = 0
  }

  // «мимо впритирку» — сақа прошла рядом и не задела
  const touched = new Set<number>()
  for (const e of events) {
    if (e.type !== 'bodyHit') continue
    if (e.a === saka.id) touched.add(e.b)
    if (e.b === saka.id) touched.add(e.a)
  }
  for (const a of asyks) {
    if (touched.has(a.id)) continue
    const d = minDist.get(a.id) ?? Number.POSITIVE_INFINITY
    const near = (saka.radius + a.radius) * PHYSICS.nearMissRadii
    if (d < near) {
      events.push({ type: 'nearMiss', tick: s.tick, bodyId: a.id, distance: d })
    }
  }

  if (saka.removed) {
    events.push({ type: 'sakaLost', tick: s.tick })
  } else {
    const inside = fieldContains(s.field, saka.x, saka.y)
    events.push({ type: 'sakaRest', tick: s.tick, inside, x: saka.x, y: saka.y })
  }

  return { finalState: s, frames, events, ticks }
}

function trackProximity(
  saka: { x: number; y: number; z: number; removed: boolean },
  asyks: Array<{ id: number; x: number; y: number; z: number; removed: boolean }>,
  minDist: Map<number, number>,
): void {
  if (saka.removed) return
  for (const a of asyks) {
    if (a.removed) continue
    const dx = a.x - saka.x
    const dy = a.y - saka.y
    const dz = a.z - saka.z
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const prev = minDist.get(a.id)
    if (prev === undefined || d < prev) minDist.set(a.id, d)
  }
}

function pushFrame(s: WorldState, frames: Frame[]): void {
  const bodies: FrameBody[] = new Array(s.bodies.length)
  for (let i = 0; i < s.bodies.length; i++) {
    const b = s.bodies[i]!
    bodies[i] = {
      id: b.id,
      x: b.x,
      y: b.y,
      z: b.z,
      tumble: b.tumble,
      yaw: b.yaw,
      removed: b.removed,
    }
  }
  frames.push({ tick: s.tick, bodies })
}

/** Высота полёта — теперь настоящая координата, а не рисованная дуга. */
export function peakHeight(frames: Frame[], bodyId: number): number {
  let peak = 0
  for (const f of frames) {
    const b = f.bodies.find((x) => x.id === bodyId)
    if (b && b.z > peak) peak = b.z
  }
  return peak
}

/** Полная механическая энергия — нужна тесту «энергия не растёт». */
export function mechanicalEnergy(state: WorldState): number {
  let e = 0
  for (const b of state.bodies) {
    if (b.removed || b.kind === 2) continue
    const v2 = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz
    e += 0.5 * b.mass * v2 + b.mass * PHYSICS.g * (b.z - b.radius)
  }
  return e
}

export { length }
