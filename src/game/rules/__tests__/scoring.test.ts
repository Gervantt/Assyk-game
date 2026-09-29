import { describe, expect, it } from 'vitest'
import { BODY_ASYK, createWorld, fieldContains, simulate, type SimEvent } from '@/physics'
import { findThrow } from './helpers'
import { DEFAULT_RULES } from '../config'
import { scoreThrow } from '../scoring'
import { comboBonus, comboFor } from '../combo'
import { returnAsykToField } from '../respawn'

const NO_PENALTY = { ...DEFAULT_RULES, sakaInFieldPenalty: false }

const row5 = () => createWorld({ seed: 5, layout: { kind: 'row', count: 5 } })
const row3 = () => createWorld({ seed: 5, layout: { kind: 'row', count: 3 } })

/** Бросок, который выбивает асық и уводит сақа из кона — штрафа быть не должно. */
const KNOCKOUT_THROW = findThrow(row5, (o) => o.knocked >= 1 && !o.insideAfter && !o.lost)
/** Бросок, который выбивает, но оставляет сақа в кону — сработает правило 5. */
const STUCK_THROW = findThrow(row3, (o) => o.knocked >= 1 && o.insideAfter)

describe('начисление очков', () => {
  it('каждый асық приносит очко только один раз (флаг scored)', () => {
    const w = row5()
    const sim = simulate(w, KNOCKOUT_THROW)
    const world = sim.finalState

    const first = scoreThrow(world, sim.events, NO_PENALTY, 0)
    expect(first.points).toBeGreaterThan(0)

    // повторно подаём ТЕ ЖЕ события — очков быть не должно
    const again = scoreThrow(world, sim.events, NO_PENALTY, first.points)
    expect(again.points).toBe(0)
    expect(again.knockedOut).toHaveLength(0)

    // и в третий раз тоже
    expect(scoreThrow(world, sim.events, NO_PENALTY, first.points).points).toBe(0)
  })

  it('асық, вернувшийся в кон, снова разыгрывается — но счёт при этом сошёлся', () => {
    const w = row3()
    // сақа гаснет и замирает в кону: срабатывает правило 5
    const sim = simulate(w, STUCK_THROW)
    const out = scoreThrow(sim.finalState, sim.events, DEFAULT_RULES, 0)
    expect(out.points).toBe(1)
    expect(out.penalty).toBe(1)
    expect(out.returnedAsyk).not.toBeNull()
    // +1 и −1 взаимно погасились, асық снова в кону и снова не оплачен
    const back = sim.finalState.bodies.find((b) => b.id === out.returnedAsyk)!
    expect(back.outOfField).toBe(false)
    expect(back.scored).toBe(false)
  })

  it('выбитым считается асық, центр которого покинул кон', () => {
    const w = row5()
    const sim = simulate(w, KNOCKOUT_THROW)
    for (const b of sim.finalState.bodies) {
      if (b.kind !== BODY_ASYK) continue
      const inside = fieldContains(sim.finalState.field, b.x, b.y)
      if (b.outOfField) expect(inside).toBe(false)
    }
  })

  it('штраф за сақа в кону: −1 очко и асық возвращается в кон', () => {
    const w = row3()
    // сначала бросок без штрафа: асық выбит, сақа ушла из кона
    const clean = findThrow(row3, (o) => o.knocked >= 1 && !o.insideAfter && !o.lost)
    const first = simulate(w, clean)
    const afterFirst = scoreThrow(first.finalState, first.events, DEFAULT_RULES, 0)
    expect(afterFirst.points).toBeGreaterThan(0)
    expect(afterFirst.penalty).toBe(0)
    const inKonAfterFirst = first.finalState.bodies.filter(
      (b) => b.kind === BODY_ASYK && !b.outOfField,
    ).length

    // теперь бросок, оставляющий сақа в кону. Ищем его по уже изменившемуся
    // кону: после первого броска асыков стало меньше
    const after = first.finalState
    const stuck = findThrow(() => structuredClone(after), (o) => o.insideAfter)
    const soft = simulate(after, stuck)
    expect(soft.events.some((e) => e.type === 'sakaRest' && e.inside)).toBe(true)
    const penalised = scoreThrow(soft.finalState, soft.events, DEFAULT_RULES, afterFirst.points)
    expect(penalised.penalty).toBe(1)
    expect(penalised.returnedAsyk).not.toBeNull()
    const inKonAfterPenalty = soft.finalState.bodies.filter(
      (b) => b.kind === BODY_ASYK && !b.outOfField,
    ).length
    expect(inKonAfterPenalty).toBe(inKonAfterFirst + 1)
  })

  it('штраф не уводит счёт в минус, когда нечего возвращать', () => {
    const w = createWorld({ seed: 5, layout: { kind: 'row', count: 0, fieldRadius: 1.4 } })
    const soft = simulate(w, findThrow(
      () => createWorld({ seed: 5, layout: { kind: 'row', count: 0, fieldRadius: 1.4 } }),
      (o) => o.insideAfter,
    ))
    const out = scoreThrow(soft.finalState, soft.events, DEFAULT_RULES, 0)
    expect(out.penalty).toBe(0)
    expect(out.returnedAsyk).toBeNull()
  })

  it('штраф можно отключить в вариантах правил', () => {
    const w = row3()
    const first = simulate(w, STUCK_THROW)
    scoreThrow(first.finalState, first.events, DEFAULT_RULES, 0)
    const soft = simulate(first.finalState, STUCK_THROW)
    const out = scoreThrow(soft.finalState, soft.events, { ...DEFAULT_RULES, sakaInFieldPenalty: false }, 1)
    expect(out.penalty).toBe(0)
  })

  it('возвращённый асық не пересекается с теми, что уже в кону', () => {
    const w = createWorld({ seed: 5, layout: { kind: 'square', count: 6 } })
    const asyk = w.bodies.find((b) => b.kind === BODY_ASYK)!
    asyk.outOfField = true
    asyk.scored = true
    const id = returnAsykToField(w)
    expect(id).toBe(asyk.id)
    const moved = w.bodies.find((b) => b.id === id)!
    for (const b of w.bodies) {
      if (b.id === id || b.outOfField || b.removed) continue
      const d = Math.sqrt((b.x - moved.x) ** 2 + (b.y - moved.y) ** 2)
      expect(d).toBeGreaterThanOrEqual(b.radius + moved.radius - 1e-9)
    }
    expect(fieldContains(w.field, moved.x, moved.y)).toBe(true)
  })
})

describe('комбо', () => {
  it('2 асыка — Қос!, 3+ — Керемет!', () => {
    expect(comboFor(1)).toBeNull()
    expect(comboFor(2)).toBe('qos')
    expect(comboFor(4)).toBe('keremet')
  })

  it('бонус начисляется только когда правило включено', () => {
    expect(comboBonus('qos', true)).toBe(1)
    expect(comboBonus('qos', false)).toBe(0)
    expect(comboBonus(null, true)).toBe(0)
  })
})

describe('счёт по искусственным событиям', () => {
  it('несуществующий id в событии игнорируется', () => {
    const w = createWorld({ seed: 5, layout: { kind: 'row', count: 2 } })
    const fake: SimEvent[] = [{ type: 'knockOut', tick: 1, bodyId: 999, x: 0, y: 0 }]
    expect(scoreThrow(w, fake, DEFAULT_RULES, 0).points).toBe(0)
  })

  it('сақа (не асық) не может принести очко', () => {
    const w = createWorld({ seed: 5, layout: { kind: 'row', count: 2 } })
    const fake: SimEvent[] = [{ type: 'knockOut', tick: 1, bodyId: 0, x: 0, y: 0 }]
    expect(scoreThrow(w, fake, DEFAULT_RULES, 0).points).toBe(0)
  })
})
