import { describe, expect, it } from 'vitest'
import { createWorld, DEFAULT_THROW_LINE_Y, asyksInField } from '../world'
import { simulate } from '../simulate'
import { stateHash } from '../hash'
import { aimFromPull, makeThrow } from '../aim'
import { PHYSICS } from '../config'
import { BODY_SAKA } from '../types'

const SEED = 777

function pull(dx: number, dy: number) {
  return makeThrow(aimFromPull({ dx, dy, maxPull: 1.6 }), { x: 0, y: DEFAULT_THROW_LINE_Y })
}

describe('simulate', () => {
  it('снимок: 20 разных бросков по одному и тому же кону', () => {
    const hashes: string[] = []
    for (let i = 0; i < 20; i++) {
      const w = createWorld({ seed: SEED, layout: { kind: 'pyramid', count: 6 } })
      const dx = -0.9 + i * 0.095
      const dy = -(0.7 + (i % 5) * 0.22)
      const r = simulate(w, pull(dx, dy))
      hashes.push(`${i}:${stateHash(r.finalState)}:${r.events.length}`)
    }
    expect(hashes).toMatchSnapshot()
  })

  it('симуляция всегда завершается и укладывается в лимит тиков', () => {
    for (let i = 0; i < 40; i++) {
      const w = createWorld({ seed: SEED + i, layout: { kind: 'row', count: 5 } })
      const r = simulate(w, pull(-1.2 + i * 0.06, -1.5))
      expect(r.ticks).toBeLessThan(PHYSICS.maxTicks)
      for (const b of r.finalState.bodies) {
        if (b.removed) continue
        expect(b.vx).toBe(0)
        expect(b.vy).toBe(0)
      }
    }
  })

  it('сильный прямой бросок выбивает хотя бы один асық', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 5 } })
    const r = simulate(w, pull(0, -1.6))
    const knocked = r.events.filter((e) => e.type === 'knockOut')
    expect(knocked.length).toBeGreaterThan(0)
    expect(asyksInField(r.finalState).length).toBeLessThan(5)
  })

  it('слабый бросок не долетает и никого не выбивает', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 5 } })
    const r = simulate(w, pull(0, -0.16))
    expect(r.events.filter((e) => e.type === 'knockOut')).toHaveLength(0)
    expect(asyksInField(r.finalState)).toHaveLength(5)
  })

  it('событие sakaStoppedInside возникает, когда сақа замерла в кону', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 0 } })
    let found = false
    for (let i = 0; i < 60 && !found; i++) {
      const r = simulate(w, pull(0, -(0.42 + i * 0.004)))
      found = r.events.some((e) => e.type === 'sakaStoppedInside')
    }
    expect(found).toBe(true)
  })

  it('очень сильный бросок уводит сақа за пределы мира', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 0 } })
    const r = simulate(w, pull(0, -10))
    const saka = r.finalState.bodies.find((b) => b.kind === BODY_SAKA)!
    expect(saka.removed).toBe(true)
    expect(r.events.some((e) => e.type === 'sakaLost')).toBe(true)
  })

  it('упругие стены дают событие wallBounce', () => {
    const w = createWorld({
      seed: SEED,
      layout: { kind: 'row', count: 0 },
      bounceWalls: true,
      boundsHalfWidth: 1.5,
      boundsHalfHeight: 4,
    })
    const r = simulate(w, pull(-1.6, -0.2))
    expect(r.events.some((e) => e.type === 'wallBounce')).toBe(true)
  })

  it('кадры идут монотонно и содержат все тела', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 5 } })
    const r = simulate(w, pull(0.2, -1.4))
    expect(r.frames.length).toBeGreaterThan(2)
    for (let i = 1; i < r.frames.length; i++) {
      expect(r.frames[i]!.tick).toBeGreaterThan(r.frames[i - 1]!.tick)
      expect(r.frames[i]!.bodies).toHaveLength(6)
    }
    expect(r.frames[r.frames.length - 1]!.tick).toBe(r.ticks)
  })

  it('высота сақа — парабола: старт и финиш на земле, пик посередине дуги', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 0 } })
    const r = simulate(w, pull(0, -1.6))
    const zs = r.frames.map((f) => f.bodies[0]!.z)
    expect(zs[0]).toBe(0)
    expect(zs[zs.length - 1]).toBe(0)
    expect(Math.max(...zs)).toBeGreaterThan(0.1)
  })
})
