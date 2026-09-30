import { describe, expect, it } from 'vitest'
import { createWorld, layoutPositions, quantize, stateHash, BODY_ASYK } from '../index'

const POS = [
  { x: 0.1234, y: -0.2 },
  { x: -0.31, y: 0.4567 },
  { x: 0.5, y: 0.5 },
]

describe('раскладка из редактора', () => {
  it('ставит асыки туда, куда указал автор, квантуя до сетки 1e-4', () => {
    const got = layoutPositions({ kind: 'custom', count: 0, positions: POS })
    expect(got).toEqual(POS.map((p) => ({ x: quantize(p.x), y: quantize(p.y) })))
  })

  it('координаты из редактора всегда ложатся на сетку 1e-4', () => {
    // мышь даёт «грязные» числа: без квантования два браузера разошлись бы
    const dirty = [{ x: 0.123456789, y: -0.98765432 }]
    const [got] = layoutPositions({ kind: 'custom', count: 0, positions: dirty })
    expect(got!.x).toBe(quantize(0.123456789))
    expect(Math.abs(got!.x * 1e4 - Math.round(got!.x * 1e4))).toBeLessThan(1e-6)
  })

  it('count не влияет на число асыков', () => {
    const w = createWorld({ seed: 7, layout: { kind: 'custom', count: 99, positions: POS } })
    expect(w.bodies.filter((b) => b.kind === BODY_ASYK)).toHaveLength(POS.length)
  })

  it('мир по такой раскладке детерминирован', () => {
    const make = () =>
      stateHash(createWorld({ seed: 7, layout: { kind: 'custom', count: 0, positions: POS } }))
    expect(make()).toBe(make())
  })

  it('пустой список позиций даёт кон без асыков', () => {
    const w = createWorld({ seed: 7, layout: { kind: 'custom', count: 5, positions: [] } })
    expect(w.bodies.filter((b) => b.kind === BODY_ASYK)).toHaveLength(0)
  })
})
