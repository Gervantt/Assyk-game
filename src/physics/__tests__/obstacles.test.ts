import { describe, expect, it } from 'vitest'
import { BODY_STONE, PHYSICS } from '..'
import { createWorld, DEFAULT_THROW_LINE_Y } from '../world'
import { simulate } from '../simulate'
import { stateHash } from '../hash'
import { aimFromPull, makeThrow } from '../aim'

function pull(dx: number, dy: number) {
  return makeThrow(aimFromPull({ dx, dy, maxPull: 1.6 }), { x: 0, y: DEFAULT_THROW_LINE_Y })
}

describe('камни-препятствия', () => {
  it('камень не сдвигается от удара и отражает сақа', () => {
    const w = createWorld({
      seed: 3,
      layout: { kind: 'row', count: 0 },
      obstacles: [{ x: 0, y: -1.4, radius: 0.22 }],
    })
    const stone = w.bodies.find((b) => b.kind === BODY_STONE)!
    const before = { x: stone.x, y: stone.y }
    const r = simulate(w, pull(0, -1.5))
    const after = r.finalState.bodies.find((b) => b.kind === BODY_STONE)!
    expect(after.x).toBe(before.x)
    expect(after.y).toBe(before.y)
    expect(r.events.some((e) => e.type === 'hit')).toBe(true)
    // сақа отскочила назад, а не прошла сквозь камень
    const saka = r.finalState.bodies[0]!
    expect(saka.y).toBeLessThan(-1.4)
  })

  it('камень закрывает асық от прямого попадания', () => {
    const open = createWorld({ seed: 3, layout: { kind: 'row', count: 1 } })
    const walled = createWorld({
      seed: 3,
      layout: { kind: 'row', count: 1 },
      obstacles: [{ x: 0, y: -0.9, radius: 0.3 }],
    })
    expect(simulate(open, pull(0, -1.5)).events.some((e) => e.type === 'knockOut')).toBe(true)
    expect(simulate(walled, pull(0, -1.5)).events.some((e) => e.type === 'knockOut')).toBe(false)
  })

  it('симуляция с камнями остаётся детерминированной', () => {
    const make = () =>
      createWorld({
        seed: 3,
        layout: { kind: 'pyramid', count: 6 },
        obstacles: [
          { x: -0.7, y: -1.2, radius: 0.2 },
          { x: 0.7, y: -1.2, radius: 0.2 },
        ],
      })
    const expected = stateHash(simulate(make(), pull(0.2, -1.5)).finalState)
    for (let i = 0; i < 200; i++) {
      expect(stateHash(simulate(make(), pull(0.2, -1.5)).finalState)).toBe(expected)
    }
  })
})

describe('наклон поля (ветер)', () => {
  it('сносит катящуюся сақа в сторону', () => {
    const straight = createWorld({ seed: 3, layout: { kind: 'row', count: 0 } })
    const windy = createWorld({ seed: 3, layout: { kind: 'row', count: 0 }, wind: { x: 1.2, y: 0 } })
    const a = simulate(straight, pull(0, -1.2)).finalState.bodies[0]!
    const b = simulate(windy, pull(0, -1.2)).finalState.bodies[0]!
    expect(b.x).toBeGreaterThan(a.x + 0.2)
  })

  it('не трогает лежащие тела: трение покоя сильнее', () => {
    const w = createWorld({ seed: 3, layout: { kind: 'row', count: 5 }, wind: { x: 1.5, y: 0 } })
    const before = w.bodies.filter((b) => b.id > 0).map((b) => b.x)
    // бросок в сторону, ни с кем не сталкивается
    const r = simulate(w, pull(-1.6, -0.1))
    const after = r.finalState.bodies.filter((b) => b.id > 0).map((b) => b.x)
    expect(after).toEqual(before)
  })

  it('ветер сильнее трения обрезается, симуляция всё равно останавливается', () => {
    const w = createWorld({ seed: 3, layout: { kind: 'row', count: 0 }, wind: { x: 99, y: 0 } })
    expect(Math.abs(w.windX)).toBeLessThanOrEqual(PHYSICS.friction * 0.8 + 1e-9)
    const r = simulate(w, pull(0, -1.2))
    expect(r.ticks).toBeLessThan(PHYSICS.maxTicks)
  })

  it('ветреная симуляция детерминирована', () => {
    const make = () =>
      createWorld({ seed: 3, layout: { kind: 'row', count: 5 }, wind: { x: -0.9, y: 0.4 } })
    const expected = stateHash(simulate(make(), pull(0.1, -1.4)).finalState)
    for (let i = 0; i < 200; i++) {
      expect(stateHash(simulate(make(), pull(0.1, -1.4)).finalState)).toBe(expected)
    }
  })
})

describe('движущийся асық', () => {
  const movingWorld = () =>
    createWorld({
      seed: 3,
      layout: { kind: 'row', count: 0 },
      movers: [{ x: 0, y: 0, axis: 'x', amplitude: 0.55, periodSec: 1.6 }],
    })

  it('колеблется вокруг своей точки, пока его не задели', () => {
    const w = movingWorld()
    const r = simulate(w, pull(-1.6, -0.05))
    const mover = r.finalState.bodies.find((b) => b.id === 1)!
    expect(r.finalState.movers).toHaveLength(1)
    expect(Math.abs(mover.x)).toBeLessThanOrEqual(0.56)
    // за время броска он успел сдвинуться
    expect(mover.x).not.toBe(0)
  })

  it('прямой бросок по центру промахивается: асық успевает уйти', () => {
    // это и есть смысл механики — нужно попасть по времени, а не только по направлению
    const r = simulate(movingWorld(), pull(0, -1.5))
    expect(r.events.some((e) => e.type === 'hit')).toBe(false)
    expect(r.finalState.movers).toHaveLength(1)
  })

  it('после попадания срывается и дальше катится обычной физикой', () => {
    // подбираем упреждение: ищем первый бросок, который догоняет асық
    let hit: ReturnType<typeof simulate> | null = null
    for (let i = 0; i <= 40 && !hit; i++) {
      const r = simulate(movingWorld(), pull(-0.6 + i * 0.03, -1.5))
      if (r.events.some((e) => e.type === 'hit')) hit = r
    }
    expect(hit, 'ни один бросок не попал по движущемуся асыку').not.toBeNull()
    expect(hit!.finalState.movers).toHaveLength(0)
    const mover = hit!.finalState.bodies.find((b) => b.id === 1)!
    expect(mover.vx).toBe(0)
    expect(mover.vy).toBe(0)
  })

  it('симуляция с движущимся асыком завершается и воспроизводится', () => {
    const expected = stateHash(simulate(movingWorld(), pull(0.1, -1.5)).finalState)
    for (let i = 0; i < 200; i++) {
      const r = simulate(movingWorld(), pull(0.1, -1.5))
      expect(r.ticks).toBeLessThan(PHYSICS.maxTicks)
      expect(stateHash(r.finalState)).toBe(expected)
    }
  })

  it('промах мимо движущегося асыка не подвешивает симуляцию', () => {
    const r = simulate(movingWorld(), pull(-1.6, -0.05))
    expect(r.ticks).toBeLessThan(PHYSICS.maxTicks)
  })
})
