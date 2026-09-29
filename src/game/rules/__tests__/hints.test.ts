import { describe, expect, it } from 'vitest'
import { aimFromPull, createWorld, DEFAULT_THROW_LINE_Y, makeThrow, simulate } from '@/physics'
import { dominantHint, hintForThrow, starsFor, type HintKey } from '../hints'

function pull(dx: number, dy: number, maxPowerScale = 1) {
  return makeThrow(aimFromPull({ dx, dy, maxPull: 1.6 }), { x: 0, y: DEFAULT_THROW_LINE_Y }, maxPowerScale)
}

function hintFor(world: ReturnType<typeof createWorld>, input: ReturnType<typeof pull>): HintKey {
  const r = simulate(world, input)
  return hintForThrow(r.finalState, r.events)
}

const row = (count = 3) => createWorld({ seed: 9, layout: { kind: 'row', count } })

describe('советы по броску', () => {
  it('перелёт: сақа улетела за пределы мира', () => {
    expect(hintFor(row(0), pull(0, -10))).toBe('hint.overshoot')
  })

  it('недолёт: сақа встала, не доехав до кона', () => {
    // минимальная сила подобрана так, что до стандартного кона сақа всё же
    // дотягивается, поэтому недолёт проверяем на уменьшенном кону
    const small = createWorld({ seed: 9, layout: { kind: 'row', count: 0, fieldRadius: 1.0 } })
    expect(hintFor(small, pull(0, -0.15))).toBe('hint.undershoot')
  })

  it('промах мимо: бросок прошёл стороной от кона', () => {
    expect(hintFor(row(), pull(-0.75, -0.35))).toBe('hint.wide')
  })

  it('задел, но не выбил', () => {
    // упираем сақа в асық почти без запаса скорости
    const w = createWorld({ seed: 9, layout: { kind: 'row', count: 1, fieldRadius: 2.6 } })
    expect(hintFor(w, pull(0, -0.55))).toBe('hint.weak')
  })

  it('сақа замерла в кону, никого не задев', () => {
    expect(hintFor(row(0), pull(0, -0.62))).toBe('hint.sakaInside')
  })

  it('выбил и сақа ушла рикошетом — похвала', () => {
    expect(hintFor(row(), pull(-0.18, -1.5))).toBe('hint.good')
  })

  it('выбил, но сақа осталась в кону — про рикошет', () => {
    expect(hintFor(row(), pull(0, -1.5))).toBe('hint.sakaInside')
  })

  it('на уровне с движущимся асыком промах объясняется таймингом', () => {
    const w = createWorld({
      seed: 9,
      layout: { kind: 'row', count: 0 },
      movers: [{ x: 0, y: 0, axis: 'x', amplitude: 0.5, periodSec: 1.6 }],
    })
    expect(hintFor(w, pull(0, -1.5))).toBe('hint.timing')
  })
})

describe('выбор главного совета', () => {
  it('берёт самый частый, похвалу не считает', () => {
    expect(dominantHint(['hint.good', 'hint.wide', 'hint.wide', 'hint.overshoot'])).toBe('hint.wide')
  })

  it('без полезных советов возвращает null', () => {
    expect(dominantHint(['hint.good', 'hint.good'])).toBeNull()
    expect(dominantHint([])).toBeNull()
  })
})

describe('звёзды', () => {
  it('3 звезды за порог и лучше, дальше по убыванию', () => {
    expect(starsFor(1, [2, 3])).toBe(3)
    expect(starsFor(2, [2, 3])).toBe(3)
    expect(starsFor(3, [2, 3])).toBe(2)
    expect(starsFor(4, [2, 3])).toBe(1)
    expect(starsFor(99, [2, 3])).toBe(1)
  })
})
