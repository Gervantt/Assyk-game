import { describe, expect, it } from 'vitest'
import { createWorld } from '../world'
import { simulate } from '../simulate'
import { stateHash } from '../hash'
import { makeThrow, aimFromPull } from '../aim'
import { mulberry32, rngAt, seedFromString } from '../rng'
import { quantize } from '../math'
import { DEFAULT_THROW_LINE_Y } from '../world'

const SEED = 20260129

function world() {
  return createWorld({ seed: SEED, layout: { kind: 'row', count: 5 } })
}

const throwUp = makeThrow(
  aimFromPull({ dx: 0.2, dy: -1.4, maxPull: 1.6 }),
  { x: 0, y: DEFAULT_THROW_LINE_Y },
)

describe('детерминизм симуляции', () => {
  it('1000 прогонов одного и того же броска дают один и тот же хеш', () => {
    const base = world()
    const expected = stateHash(simulate(base, throwUp).finalState)
    for (let i = 0; i < 1000; i++) {
      expect(stateHash(simulate(world(), throwUp).finalState)).toBe(expected)
    }
  })

  it('simulate не мутирует переданное состояние', () => {
    const base = world()
    const before = stateHash(base)
    simulate(base, throwUp)
    simulate(base, throwUp)
    expect(stateHash(base)).toBe(before)
  })

  it('кадры и события совпадают между прогонами', () => {
    const a = simulate(world(), throwUp)
    const b = simulate(world(), throwUp)
    expect(a.ticks).toBe(b.ticks)
    expect(a.frames.length).toBe(b.frames.length)
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events))
    expect(JSON.stringify(a.frames)).toBe(JSON.stringify(b.frames))
  })

  it('разный seed не влияет на траекторию, только на сторону падения', () => {
    const w1 = createWorld({ seed: 1, layout: { kind: 'row', count: 5 } })
    const w2 = createWorld({ seed: 999, layout: { kind: 'row', count: 5 } })
    const r1 = simulate(w1, throwUp)
    const r2 = simulate(w2, throwUp)
    const pos = (r: typeof r1) => r.finalState.bodies.map((b) => [b.x, b.y].join(':')).join('|')
    expect(pos(r1)).toBe(pos(r2))
    expect(stateHash(r1.finalState)).not.toBe(stateHash(r2.finalState))
  })

  it('квантование обрезает шум последних битов', () => {
    expect(quantize(0.1 + 0.2)).toBe(quantize(0.3))
    expect(quantize(1.000049)).toBe(quantize(1.00002))
  })

  it('mulberry32 воспроизводим и не зависит от порядка вызовов', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 50; i++) expect(a()).toBe(b())
    expect(rngAt(7, 3)).toBe(rngAt(7, 3))
    expect(rngAt(7, 3)).not.toBe(rngAt(7, 4))
    expect(seedFromString('2026-01-29')).toBe(seedFromString('2026-01-29'))
  })
})

describe('чистота модуля physics', () => {
  it('не тянет за собой React, three, zustand и косметику', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const dir = path.resolve(__dirname, '..')
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.ts'))
    const banned = /from\s+['"](react|three|zustand|@react-three|@\/(?!physics)|.*\/cosmetics)/
    for (const f of files) {
      const src = await fs.readFile(path.join(dir, f), 'utf8')
      expect(src, `${f} импортирует запрещённый модуль`).not.toMatch(banned)
    }
  })

  it('в шаге симуляции нет sin/cos/atan/random', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    for (const f of ['step.ts', 'simulate.ts', 'hash.ts', 'field.ts']) {
      const src = await fs.readFile(path.resolve(__dirname, '..', f), 'utf8')
      expect(src, `${f}`).not.toMatch(/Math\.(sin|cos|tan|atan2?|random|pow|hypot)/)
    }
  })
})
