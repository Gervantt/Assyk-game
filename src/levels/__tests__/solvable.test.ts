import { describe, expect, it } from 'vitest'
import { aimFromAngle, DEFAULT_THROW_LINE_Y, makeThrow } from '@/physics'
import { applyThrow, createMatch, knockedOutCount, type MatchState } from '@/game/rules'
import {
  CAMPAIGN,
  createLevelWorld,
  rulesFor,
  totalAsyks,
  worldExtrasFor,
  type CampaignLevel,
} from '..'

/**
 * Каждый уровень прогоняется перебором бросков по НАСТОЯЩИМ правилам —
 * через applyThrow, то есть со штрафом за сақа в кону и возвратом асыка.
 * Это страховка от непроходимых уровней: если лучевой поиск не укладывается
 * в бюджет бросков, живой игрок тем более не уложится.
 */

const ANGLES = 21
const POWERS = 7
/** прицел от «прямо вперёд» в радианах */
const SPREAD = 0.45
const BEAM = 2

const SEED = 4242
const ORIGIN = { x: 0, y: DEFAULT_THROW_LINE_Y }

function candidates(level: CampaignLevel) {
  const out = []
  for (let a = 0; a < ANGLES; a++) {
    const angle = Math.PI / 2 - SPREAD + (2 * SPREAD * a) / (ANGLES - 1)
    for (let p = 0; p < POWERS; p++) {
      const power = 0.18 + (0.82 * p) / (POWERS - 1)
      out.push(makeThrow(aimFromAngle(angle, power), ORIGIN, level.maxPower ?? 1))
    }
  }
  return out
}

function matchFor(level: CampaignLevel): MatchState {
  return createMatch({
    mode: 'campaign',
    seed: SEED,
    layout: {
      kind: level.layout.kind,
      count: level.layout.count,
      fieldRadius: level.layout.fieldRadius,
      shape: level.layout.shape,
      spacing: level.layout.spacing,
    },
    playerNames: ['solver'],
    rules: rulesFor(level),
    world: worldExtrasFor(level),
  })
}

/** Минимум бросков, за который перебор достигает цели. null — не смог. */
function solve(level: CampaignLevel): number | null {
  const options = candidates(level)
  let beam: MatchState[] = [matchFor(level)]

  for (let depth = 1; depth <= level.throws; depth++) {
    const scored: Array<{ match: MatchState; knocked: number }> = []
    for (const match of beam) {
      if (match.status === 'finished') continue
      for (const input of options) {
        const next = applyThrow(match, input).match
        const knocked = knockedOutCount(next.world)
        if (knocked >= level.goal) return depth
        scored.push({ match: next, knocked })
      }
    }
    scored.sort((a, b) => b.knocked - a.knocked)
    beam = scored.slice(0, BEAM).map((s) => s.match)
    if (beam.length === 0) return null
  }
  return null
}

describe('кампания', () => {
  it('24 уровня в 4 главах, сквозная нумерация', () => {
    expect(CAMPAIGN).toHaveLength(24)
    expect(new Set(CAMPAIGN.map((l) => l.chapterId)).size).toBe(4)
    CAMPAIGN.forEach((l, i) => expect(l.number).toBe(i + 1))
  })

  it('цель каждого уровня не превышает число асыков на поле', () => {
    for (const l of CAMPAIGN) expect(l.goal).toBeLessThanOrEqual(totalAsyks(l))
  })

  it('пороги звёзд укладываются в бюджет бросков', () => {
    for (const l of CAMPAIGN) {
      expect(l.stars[0]).toBeGreaterThanOrEqual(1)
      expect(l.stars[1]).toBeGreaterThanOrEqual(l.stars[0])
      expect(l.stars[1]).toBeLessThanOrEqual(l.throws)
    }
  })

  it('мир уровня строится и воспроизводится по seed', () => {
    for (const l of CAMPAIGN) {
      const a = createLevelWorld(l, SEED)
      const b = createLevelWorld(l, SEED)
      expect(a.bodies.map((x) => `${x.x}:${x.y}`)).toEqual(b.bodies.map((x) => `${x.x}:${x.y}`))
    }
  })

  it.each(CAMPAIGN.map((l) => [l.number, l.id, l] as const))(
    'уровень %i (%s) проходится в отведённые броски',
    (_n, _id, level) => {
      const used = solve(level)
      expect(used, 'перебор не нашёл решения').not.toBeNull()
      expect(used!).toBeLessThanOrEqual(level.throws)
      // порог на две звезды должен быть достижим идеальным игроком,
      // иначе пороги откалиброваны неверно
      expect(used!, 'две звезды недостижимы').toBeLessThanOrEqual(level.stars[1])
    },
    30000,
  )
})
