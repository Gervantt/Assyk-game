import { describe, expect, it } from 'vitest'
import { createWorld, simulate, type WorldState } from '@/physics'
import { dominantHint, hintForThrow, starsFor, type HintKey } from '../hints'
import { findThrow, outcomeOf, shot } from './helpers'

function hintOf(world: WorldState, input: ReturnType<typeof shot>): HintKey {
  const r = simulate(world, input)
  return hintForThrow(r.finalState, r.events)
}

const row = (count = 3, fieldRadius?: number) => () =>
  createWorld({ seed: 9, layout: { kind: 'row', count, fieldRadius } })

describe('советы по броску', () => {
  it('перелёт: сақа улетела за пределы мира', () => {
    const empty = () => createWorld({ seed: 9, layout: { kind: 'row', count: 0 }, boundsHalfHeight: 2 })
    expect(hintOf(empty(), findThrow(empty, (o) => o.lost))).toBe('hint.overshoot')
  })

  it('недолёт: сақа встала, не доехав до кона', () => {
    const small = row(0, 0.6)
    const input = findThrow(small, (o) => {
      const saka = o.sim.finalState.bodies[0]!
      return !saka.removed && saka.y < -0.6 && !o.insideAfter
    })
    expect(hintOf(small(), input)).toBe('hint.undershoot')
  })

  it('промах мимо: бросок прошёл стороной от кона', () => {
    const w = row(3)
    const input = findThrow(w, (o) => {
      const saka = o.sim.finalState.bodies[0]!
      return !o.hit && !o.lost && Math.abs(saka.x) > 1.6
    })
    expect(hintOf(w(), input)).toBe('hint.wide')
  })

  it('задел, но не выбил', () => {
    // огромный кон: асық сдвинуть можно, выбить почти нельзя.
    // «задел» важнее «сақа в кону» — так устроен приоритет советов
    const wide = row(1, 2.6)
    expect(hintOf(wide(), findThrow(wide, (o) => o.hit && o.knocked === 0 && !o.lost))).toBe(
      'hint.weak',
    )
  })

  it('сақа замерла в кону, никого не задев', () => {
    const empty = row(0, 1.4)
    expect(hintOf(empty(), findThrow(empty, (o) => o.insideAfter && !o.hit))).toBe('hint.sakaInside')
  })

  it('выбил и сақа ушла из кона — похвала', () => {
    const w = row(3)
    expect(hintOf(w(), findThrow(w, (o) => o.knocked >= 1 && !o.insideAfter && !o.lost))).toBe(
      'hint.good',
    )
  })

  it('выбил, но сақа осталась в кону — про рикошет', () => {
    const w = row(3)
    expect(hintOf(w(), findThrow(w, (o) => o.knocked >= 1 && o.insideAfter))).toBe('hint.sakaInside')
  })

  it('на уровне с движущимся асыком промах объясняется таймингом', () => {
    const moving = () =>
      createWorld({
        seed: 9,
        layout: { kind: 'row', count: 0 },
        movers: [{ x: 0, y: 0, axis: 'x', amplitude: 0.5, periodSec: 1.6 }],
      })
    const input = findThrow(moving, (o) => {
      const saka = o.sim.finalState.bodies[0]!
      return !o.hit && !o.lost && !o.insideAfter && saka.y > 0 && Math.abs(saka.x) < 1.4
    })
    expect(hintOf(moving(), input)).toBe('hint.timing')
  })

  it('outcomeOf и findThrow согласованы между собой', () => {
    const w = row(3)
    const input = findThrow(w, (o) => o.knocked >= 1)
    expect(outcomeOf(w(), input).knocked).toBeGreaterThanOrEqual(1)
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
