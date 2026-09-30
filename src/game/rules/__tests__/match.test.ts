import { describe, expect, it } from 'vitest'
import { asyksInField, createWorld } from '@/physics'
import { findThrow } from './helpers'
import { accuracy, applyThrow, createMatch, drawFirstPlayer, restartMatch } from '../match'
import { konIsEmpty, leader, nextPlayer } from '../turn'
import type { MatchState } from '../types'

const row5 = () => createWorld({ seed: 5, layout: { kind: 'row', count: 5 } })
const row1 = () => createWorld({ seed: 5, layout: { kind: 'row', count: 1 } })

/** Бросок, который выбивает асық и не оставляет сақа в кону. */
const HIT = findThrow(row5, (o) => o.knocked >= 1 && !o.insideAfter && !o.lost)
/** Заведомый промах: никого не задел и сақа не в кону. */
const MISS = findThrow(row5, (o) => !o.hit && !o.insideAfter && !o.lost)
/** Бросок, выбивающий единственный асық. */
const HIT_SINGLE = findThrow(row1, (o) => o.knocked >= 1)
/** Выбивает единственный асық и при этом сақа остаётся в кону — сработает правило 5. */
const HIT_SINGLE_STUCK = findThrow(row1, (o) => o.knocked >= 1 && o.insideAfter)

function training(count = 5): MatchState {
  return createMatch({
    mode: 'training',
    seed: 5,
    layout: { kind: 'row', count },
    playerNames: ['Сен'],
  })
}

function hotseat(count = 5): MatchState {
  return createMatch({
    mode: 'hotseat',
    seed: 5,
    layout: { kind: 'row', count },
    playerNames: ['Ойыншы 1', 'Ойыншы 2'],
  })
}

describe('жеребьёвка (правило 7)', () => {
  it('детерминирована по seed', () => {
    expect(drawFirstPlayer(12345, 2)).toEqual(drawFirstPlayer(12345, 2))
    expect(drawFirstPlayer(12345, 2).tosses).toHaveLength(2)
  })

  it('начинает тот, у кого сторона старше (алшы > тәйкі > бүк > шік)', () => {
    const rank = { alshy: 3, tayki: 2, buk: 1, shik: 0 } as const
    for (let seed = 0; seed < 200; seed++) {
      const { first, tosses } = drawFirstPlayer(seed, 2)
      const best = Math.max(...tosses.map((t) => rank[t]))
      expect(rank[tosses[first]!]).toBe(best)
    }
  })
})

describe('режим «тренировка»', () => {
  it('ровно 5 бросков, потом матч завершён', () => {
    let m = training()
    for (let i = 0; i < 5; i++) {
      expect(m.status).toBe('aiming')
      m = applyThrow(m, MISS).match
    }
    expect(m.status).toBe('finished')
    expect(m.players[0]!.throwsUsed).toBe(5)
    expect(m.winner).toBe(0)
  })

  it('бросок после завершения матча запрещён', () => {
    let m = training()
    for (let i = 0; i < 5; i++) m = applyThrow(m, MISS).match
    expect(() => applyThrow(m, MISS)).toThrow()
  })

  it('дополнительных бросков за выбитый асық в тренировке нет', () => {
    const m = training()
    const after = applyThrow(m, HIT).match
    expect(after.players[0]!.throwsUsed).toBe(1)
    expect(after.players[0]!.score).toBeGreaterThan(0)
  })

  it('матч завершается досрочно, когда кон пуст', () => {
    // штраф отключён, чтобы единственный асық не вернулся в кон по правилу 5
    let m = createMatch({
      mode: 'training',
      seed: 5,
      layout: { kind: 'row', count: 1 },
      playerNames: ['Сен'],
      rules: { sakaInFieldPenalty: false },
    })
    m = applyThrow(m, HIT_SINGLE).match
    expect(konIsEmpty(m.world)).toBe(true)
    expect(m.status).toBe('finished')
    expect(m.players[0]!.throwsUsed).toBe(1)
  })

  it('штраф может вернуть последний асық и продлить раунд', () => {
    let m = training(1)
    const r = applyThrow(m, HIT_SINGLE_STUCK)
    expect(r.summary.points).toBe(1)
    expect(r.summary.penalty).toBe(1)
    expect(r.summary.returnedAsyk).not.toBeNull()
    m = r.match
    expect(konIsEmpty(m.world)).toBe(false)
    expect(m.players[0]!.score).toBe(0)
    expect(m.status).toBe('aiming')
  })

  it('статистика: точность, лучший бросок, серия', () => {
    let m = training()
    m = applyThrow(m, HIT).match
    m = applyThrow(m, MISS).match
    const p = m.players[0]!
    expect(p.throwsUsed).toBe(2)
    expect(p.hits).toBe(1)
    expect(accuracy(p)).toBeCloseTo(0.5)
    expect(p.bestStreak).toBe(1)
    expect(p.streak).toBe(0)
    expect(p.bestThrow).toBeGreaterThanOrEqual(1)
  })

  it('перезапуск сбрасывает счёт и возвращает асыки в кон', () => {
    let m = training()
    m = applyThrow(m, HIT).match
    const fresh = restartMatch(m, 99)
    expect(fresh.players[0]!.score).toBe(0)
    expect(fresh.players[0]!.throwsUsed).toBe(0)
    expect(fresh.status).toBe('aiming')
    expect(asyksInField(fresh.world)).toHaveLength(5)
  })
})

describe('hot-seat (строгое чередование)', () => {
  it('даже после попадания ход переходит сопернику', () => {
    const m = hotseat()
    const r = applyThrow(m, HIT)
    expect(r.summary.points).toBeGreaterThan(0)
    expect(r.match.currentPlayer).not.toBe(m.currentPlayer)
  })

  it('оба игрока успевают бросить, как бы метко ни играл первый', () => {
    let m = hotseat()
    const seen = new Set<number>()
    for (let i = 0; i < 10 && m.status !== 'finished'; i++) {
      seen.add(m.currentPlayer)
      m = applyThrow(m, HIT).match
    }
    expect(seen).toEqual(new Set([0, 1]))
    expect(m.players.every((p) => p.throwsUsed > 0)).toBe(true)
  })

  it('промах — ход переходит сопернику', () => {
    const m = hotseat()
    const r = applyThrow(m, MISS)
    expect(r.summary.points).toBe(0)
    expect(r.match.currentPlayer).not.toBe(m.currentPlayer)
  })

  it('ход не передаётся игроку, у которого кончились броски', () => {
    const m = hotseat()
    const spent: MatchState = {
      ...m,
      currentPlayer: 0,
      players: m.players.map((p, i) => ({ ...p, throwsUsed: i === 1 ? 5 : 0 })),
    }
    expect(nextPlayer(spent, 0)).toBe(0)
  })

  it('матч заканчивается, когда броски кончились у всех', () => {
    let m = hotseat()
    let guard = 0
    while (m.status === 'aiming' && guard++ < 30) m = applyThrow(m, MISS).match
    expect(m.status).toBe('finished')
    expect(m.players[0]!.throwsUsed).toBe(5)
    expect(m.players[1]!.throwsUsed).toBe(5)
  })

  it('побеждает тот, у кого больше асыков; при равенстве — решающий бросок', () => {
    const m = hotseat()
    expect(leader([{ ...m.players[0]! }, { ...m.players[1]! }])).toBeNull()
    const winnerByScore = leader([
      { ...m.players[0]!, score: 3 },
      { ...m.players[1]!, score: 1 },
    ])
    expect(winnerByScore).toBe(0)

    let played = hotseat()
    let guard = 0
    while (played.status === 'aiming' && guard++ < 30) played = applyThrow(played, MISS).match
    expect(played.winner).toBeNull()
    expect(played.decisive).toBe(true)
  })

  it('история бросков ведётся с хешем результата', () => {
    let m = hotseat()
    m = applyThrow(m, MISS).match
    m = applyThrow(m, HIT).match
    expect(m.history).toHaveLength(2)
    expect(m.history[0]!.resultHash).toMatch(/^[0-9a-f]{8}$/)
    expect(m.history[1]!.player).not.toBe(m.history[0]!.player)
    expect(m.turnNo).toBe(2)
  })

  it('applyThrow не мутирует прежнее состояние матча', () => {
    const m = hotseat()
    const before = JSON.stringify(m.players)
    applyThrow(m, HIT)
    applyThrow(m, HIT)
    expect(JSON.stringify(m.players)).toBe(before)
  })
})

describe('строгое чередование (онлайн-матч по ссылке)', () => {
  it('без правила «выбил — бросай ещё» ход переходит даже после попадания', () => {
    const online = createMatch({
      mode: 'hotseat',
      seed: 5,
      layout: { kind: 'row', count: 5 },
      playerNames: ['A', 'B'],
      rules: { extraThrowOnKnockOut: false, throwsPerPlayer: 5, goal: 0 },
    })
    const r = applyThrow(online, HIT)
    expect(r.summary.points, 'нужен результативный бросок').toBeGreaterThan(0)
    expect(r.match.currentPlayer, 'ход обязан перейти сопернику').not.toBe(online.currentPlayer)
  })

  it('с правилом включённым попадание оставляет ход у того же игрока', () => {
    const yard = createMatch({
      mode: 'hotseat',
      seed: 5,
      layout: { kind: 'row', count: 5 },
      playerNames: ['A', 'B'],
      rules: { extraThrowOnKnockOut: true, throwsPerPlayer: 5, goal: 0 },
    })
    const r = applyThrow(yard, HIT)
    expect(r.summary.points).toBeGreaterThan(0)
    expect(r.match.currentPlayer).toBe(yard.currentPlayer)
  })

  it('у каждого игрока ровно свой бюджет бросков', () => {
    let m = createMatch({
      mode: 'hotseat',
      seed: 5,
      layout: { kind: 'row', count: 5 },
      playerNames: ['A', 'B'],
      rules: { extraThrowOnKnockOut: false, throwsPerPlayer: 3, goal: 0 },
    })
    let guard = 0
    while (m.status === 'aiming' && guard++ < 20) m = applyThrow(m, MISS).match
    expect(m.players[0]!.throwsUsed).toBe(3)
    expect(m.players[1]!.throwsUsed).toBe(3)
  })
})
