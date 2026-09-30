import { describe, expect, it } from 'vitest'
import { BODY_ASYK, BODY_STONE, createWorld, stateHash } from '@/physics'
import { findThrow } from './helpers'
import { applyThrow } from '../match'
import { buildOnlineMatch, replayMatch, type OnlineRules } from '../replay'

const RULES: OnlineRules = {
  first: 0,
  layout: { kind: 'row', count: 5, fieldRadius: 0.93 },
  sakaInFieldPenalty: true,
  throwsPerPlayer: 5,
}
const SEED = 424242

const world = () => createWorld({ seed: SEED, layout: RULES.layout as never })
const HIT = findThrow(world, (o) => o.knocked >= 1)
const MISS = findThrow(world, (o) => !o.hit && !o.insideAfter && !o.lost)

/** Партия, сыгранная «как на клиенте»: ходы и хеши после каждого из них. */
function playLocally(inputs: ReturnType<typeof findThrow>[]) {
  let m = buildOnlineMatch(SEED, RULES, ['A', 'B'])
  const moves = []
  for (const input of inputs) {
    if (m.status === 'finished') break
    m = applyThrow(m, input).match
    moves.push({ input, result_hash: stateHash(m.world) })
  }
  return { match: m, moves }
}

describe('пересчёт матча на сервере', () => {
  const script = [HIT, MISS, HIT, HIT, MISS, HIT, MISS, HIT, HIT, MISS]

  it('повторяет партию бросок в бросок', () => {
    const local = playLocally(script)
    const server = replayMatch(SEED, RULES, local.moves, ['A', 'B'])

    expect(server.mismatchAt).toBeNull()
    expect(server.match.status).toBe(local.match.status)
    expect(server.match.winner).toBe(local.match.winner)
    expect(server.match.players.map((p) => p.score)).toEqual(
      local.match.players.map((p) => p.score),
    )
    expect(stateHash(server.match.world)).toBe(stateHash(local.match.world))
  })

  it('замечает подделанный хеш хода', () => {
    const local = playLocally(script)
    const tampered = local.moves.map((m, i) =>
      i === 2 ? { ...m, result_hash: 'подделка' } : m,
    )
    expect(replayMatch(SEED, RULES, tampered, ['A', 'B']).mismatchAt).toBe(3)
  })

  it('подделанный бросок даёт другой итог, чем заявленные хеши', () => {
    const local = playLocally(script)
    // соперник прислал «свой» результат, но сам бросок заменён на промах
    const tampered = local.moves.map((m, i) => (i === 0 ? { ...m, input: MISS } : m))
    const server = replayMatch(SEED, RULES, tampered, ['A', 'B'])
    expect(server.mismatchAt).toBe(1)
  })

  it('первым ходит тот, кто записан в rules.first, а не производный от seed', () => {
    expect(buildOnlineMatch(SEED, { ...RULES, first: 0 }, ['A', 'B']).currentPlayer).toBe(0)
    expect(buildOnlineMatch(SEED, { ...RULES, first: 1 }, ['A', 'B']).currentPlayer).toBe(1)
  })

  it('оба игрока делают одинаковое число бросков', () => {
    const local = playLocally([...script, ...script])
    expect(local.match.status).toBe('finished')
    const used = local.match.players.map((p) => p.throwsUsed)
    expect(Math.abs(used[0]! - used[1]!)).toBeLessThanOrEqual(1)
  })
})

describe('карта матча доезжает до сервера целиком', () => {
  const WITH_STONES: OnlineRules = {
    ...RULES,
    layout: { kind: 'row', count: 4, fieldRadius: 0.85 },
    stones: [
      { x: -0.52, y: -1.25, radius: 0.2 },
      { x: 0.52, y: -1.25, radius: 0.2 },
    ],
    relief: 0.03,
  }

  it('камни попадают в мир', () => {
    const m = buildOnlineMatch(SEED, WITH_STONES, ['A', 'B'])
    expect(m.world.bodies.filter((b) => b.kind === BODY_STONE)).toHaveLength(2)
  })

  it('рельеф попадает в мир', () => {
    expect(buildOnlineMatch(SEED, WITH_STONES, ['A', 'B']).world.reliefAmp).toBe(0.03)
    expect(buildOnlineMatch(SEED, { ...WITH_STONES, relief: 0 }, ['A', 'B']).world.reliefAmp).toBe(0)
  })

  it('пересчёт на сервере даёт тот же результат, что игра на клиенте', () => {
    // если бы сервер собирал кон без камней, хеши разошлись бы с первого хода
    let local = buildOnlineMatch(SEED, WITH_STONES, ['A', 'B'])
    const moves = []
    for (const input of [HIT, MISS, HIT, MISS]) {
      if (local.status === 'finished') break
      local = applyThrow(local, input).match
      moves.push({ input, result_hash: stateHash(local.world) })
    }
    const server = replayMatch(SEED, WITH_STONES, moves, ['A', 'B'])
    expect(server.mismatchAt).toBeNull()
    expect(stateHash(server.match.world)).toBe(stateHash(local.world))
  })

  it('кон из редактора собирается по явным позициям', () => {
    const positions = [
      { x: -0.2, y: 0.1 },
      { x: 0.25, y: -0.15 },
      { x: 0, y: 0.3 },
    ]
    const m = buildOnlineMatch(SEED, {
      ...RULES,
      layout: { kind: 'custom', count: positions.length, fieldRadius: 0.9, positions },
    }, ['A', 'B'])
    const asyks = m.world.bodies.filter((b) => b.kind === BODY_ASYK)
    expect(asyks).toHaveLength(3)
    expect(asyks.map((b) => b.x)).toEqual(positions.map((p) => p.x))
  })
})
