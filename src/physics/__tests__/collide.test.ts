import { describe, expect, it } from 'vitest'
import { PHYSICS } from '../config'
import { fieldContains } from '../field'
import { isSettled, stepWorld } from '../step'
import { STATE_RESTING, STATE_SLIDING } from '../config'
import { SURFACE_SAND } from '../surfaces'
import { BODY_ASYK, BODY_SAKA, type Body, type WorldState } from '../types'

function body(over: Partial<Body>): Body {
  return {
    id: 0,
    kind: BODY_ASYK,
    x: 0,
    y: 0,
    z: PHYSICS.asykRadius,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: PHYSICS.asykRadius,
    mass: PHYSICS.asykMass,
    height: PHYSICS.asykHeight,
    tumble: 0,
    omega: 0,
    yaw: 0,
    state: STATE_SLIDING,
    outOfField: false,
    removed: false,
    side: 0,
    scored: false,
    ...over,
  }
}

function world(bodies: Body[]): WorldState {
  return {
    bodies,
    field: { shape: 'circle', cx: 0, cy: 0, radius: 1.15 },
    bounds: { halfWidth: 4.6, halfHeight: 4.6, bounce: false },
    surfaceId: SURFACE_SAND,
    windX: 0,
    windY: 0,
    movers: [],
    throwLineY: -3.1,
    // ровный пол: тесты столкновений проверяют удары тел, а не рельеф
    reliefAmp: 0,
    seed: 1,
    rngCursor: 0,
    tick: 0,
  }
}

describe('столкновения и трение', () => {
  it('лобовой удар передаёт импульс покоящемуся телу', () => {
    const a = body({ id: 0, kind: BODY_SAKA, x: -0.3, y: 0, z: PHYSICS.sakaRadius, vx: 4, mass: PHYSICS.sakaMass, radius: PHYSICS.sakaRadius, state: STATE_SLIDING })
    const b = body({ id: 1, x: 0, y: 0, state: STATE_RESTING })
    const s = world([a, b])
    const events: ReturnType<typeof Array.prototype.slice> = []
    for (let i = 0; i < 40; i++) stepWorld(s, events as never)
    expect(b.vx).toBeGreaterThan(0)
    expect(a.vx).toBeLessThan(4)
    expect(events.some((e: { type: string }) => e.type === 'bodyHit')).toBe(true)
  })

  it('тела не залипают друг в друге', () => {
    const a = body({ id: 0, x: 0, y: 0, state: STATE_RESTING })
    const b = body({ id: 1, x: 0.01, y: 0, vx: -1, state: STATE_SLIDING })
    const s = world([a, b])
    for (let i = 0; i < 20; i++) stepWorld(s, [])
    const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
    expect(d).toBeGreaterThanOrEqual(a.radius + b.radius - 1e-6)
  })

  it('трение останавливает тело за конечное время', () => {
    const a = body({ id: 0, vx: 3, vy: 0, state: STATE_SLIDING })
    const s = world([a])
    let ticks = 0
    while (!isSettled(s) && ticks < PHYSICS.maxTicks) {
      stepWorld(s, [])
      ticks++
    }
    expect(ticks).toBeLessThan(PHYSICS.maxTicks)
    expect(a.vx).toBe(0)
    expect(a.x).toBeGreaterThan(0)
  })

  it('knockOut срабатывает один раз на асық', () => {
    const a = body({ id: 1, x: 1.0, y: 0, vx: 2, state: STATE_SLIDING })
    const s = world([a])
    const events: Array<{ type: string }> = []
    for (let i = 0; i < 300; i++) stepWorld(s, events as never)
    expect(events.filter((e) => e.type === 'knockOut')).toHaveLength(1)
  })

  it('форма кона учитывается: круг и квадрат считают по-разному', () => {
    const circle = { shape: 'circle' as const, cx: 0, cy: 0, radius: 1 }
    const square = { shape: 'square' as const, cx: 0, cy: 0, radius: 1 }
    expect(fieldContains(circle, 0.9, 0.9)).toBe(false)
    expect(fieldContains(square, 0.9, 0.9)).toBe(true)
    expect(fieldContains(circle, 0.5, 0.5)).toBe(true)
    expect(fieldContains(square, 1.2, 0)).toBe(false)
  })

  it('тело за границей мира удаляется из симуляции', () => {
    const a = body({ id: 1, x: 4.5, y: 0, vx: 9, state: STATE_SLIDING })
    const s = world([a])
    for (let i = 0; i < 200; i++) stepWorld(s, [])
    expect(a.removed).toBe(true)
    expect(isSettled(s)).toBe(true)
  })
})
