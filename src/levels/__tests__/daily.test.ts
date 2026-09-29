import { describe, expect, it } from 'vitest'
import { aimFromAngles, DEFAULT_THROW_LINE_Y, makeThrow, simulate } from '@/physics'
import { applyThrow, createMatch, knockedOutCount } from '@/game/rules'
import { createLevelWorld, rulesFor, worldExtrasFor } from '..'
import { dailyLevel, dailySeed, DAILY_THROWS, todayISO } from '../daily'

const DATES = ['2026-01-01', '2026-02-14', '2026-06-30', '2026-09-30', '2026-12-31']

describe('ежедневное испытание', () => {
  it('у всех один и тот же кон в один и тот же день', () => {
    for (const date of DATES) {
      const a = dailyLevel(date)
      const b = dailyLevel(date)
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
      expect(dailySeed(date)).toBe(dailySeed(date))
    }
  })

  it('в разные дни кон разный', () => {
    const shapes = new Set(DATES.map((d) => JSON.stringify(dailyLevel(d))))
    expect(shapes.size).toBeGreaterThan(1)
  })

  it('дата берётся по UTC, а не по местному времени', () => {
    // одна и та же точка времени -> одна и та же дата в любом поясе
    const moment = new Date('2026-06-30T23:30:00Z')
    expect(todayISO(moment)).toBe('2026-06-30')
    expect(todayISO(new Date('2026-07-01T00:30:00Z'))).toBe('2026-07-01')
  })

  it('расстановка воспроизводится по seed', () => {
    for (const date of DATES) {
      const level = dailyLevel(date)
      const seed = dailySeed(date)
      const a = createLevelWorld(level, seed)
      const b = createLevelWorld(level, seed)
      expect(a.bodies.map((x) => `${x.x}:${x.y}`)).toEqual(b.bodies.map((x) => `${x.x}:${x.y}`))
    }
  })

  it('на поле есть асыки и ровно пять бросков', () => {
    for (const date of DATES) {
      const level = dailyLevel(date)
      expect(level.throws).toBe(DAILY_THROWS)
      const total = level.layout.count + (level.movers?.length ?? 0)
      expect(total).toBeGreaterThanOrEqual(3)
      expect(level.goal).toBeLessThanOrEqual(total)
    }
  })

  it('за пять бросков можно выбить хотя бы один асық в любой день', () => {
    for (const date of DATES) {
      const level = dailyLevel(date)
      let match = createMatch({
        mode: 'daily',
        seed: dailySeed(date),
        layout: { ...level.layout },
        playerNames: ['solver'],
        rules: rulesFor(level),
        world: worldExtrasFor(level),
      })

      let best = 0
      for (let a = 0; a < 9 && best === 0; a++) {
        const yaw = -0.36 + (0.72 * a) / 8
        for (const deg of [6, 16, 28]) {
          if (best > 0) break
          for (let p = 0; p < 5 && best === 0; p++) {
            const power = 0.3 + (0.7 * p) / 4
            const input = makeThrow(aimFromAngles(yaw, (deg * Math.PI) / 180, power), {
              x: 0,
              y: DEFAULT_THROW_LINE_Y,
            })
            best = Math.max(best, knockedOutCount(simulate(match.world, input).finalState))
          }
        }
      }
      expect(best, `${date}: ни один бросок не выбил асық`).toBeGreaterThan(0)
      match = applyThrow(
        match,
        makeThrow(aimFromAngles(0, 0.2, 0.8), { x: 0, y: DEFAULT_THROW_LINE_Y }),
      ).match
      expect(match.players[0]!.throwsUsed).toBe(1)
    }
  })
})
