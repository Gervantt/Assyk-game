import { describe, expect, it } from 'vitest'
import { aimFromPull } from '@/physics'

/**
 * Перевод тяги пальца в силу броска. Проверяем на реальных размерах экранов:
 * если полная сила достигается слишком рано, обычный свайп всегда упирается
 * в максимум и игрок не может выбрать силу — именно на этом новичок застревал
 * на втором шаге обучения.
 */
const MAX_PULL_RATIO = 0.38
/** Зона, которую просит поймать обучение. */
const ZONE: [number, number] = [0.45, 0.85]

const SCREENS = [
  { name: 'iPhone SE', short: 375 },
  { name: 'Pixel 7', short: 412 },
  { name: 'iPad mini', short: 744 },
]

function powerFor(pullPx: number, short: number): number {
  return aimFromPull(0, { dx: 0, dy: pullPx, maxPull: short * MAX_PULL_RATIO }).power
}

describe('тяга пальца → сила', () => {
  it.each(SCREENS)('$name: зона обучения попадает на обычный свайп', ({ short }) => {
    const inZone: number[] = []
    for (let px = 10; px <= 400; px += 2) {
      const p = powerFor(px, short)
      if (p >= ZONE[0] && p <= ZONE[1]) inZone.push(px)
    }
    const from = inZone[0]!
    const to = inZone[inZone.length - 1]!
    // зона должна быть не уже сантиметра движения и начинаться не вплотную к нулю
    expect(to - from).toBeGreaterThanOrEqual(40)
    expect(from).toBeGreaterThanOrEqual(45)
  })

  it.each(SCREENS)('$name: полная сила требует заметного движения', ({ short }) => {
    expect(powerFor(100, short)).toBeLessThan(1)
  })

  it('короткое движение остаётся мёртвой зоной — случайный тап не бросает', () => {
    expect(powerFor(6, 412)).toBe(0)
  })

  it('сила растёт монотонно', () => {
    let prev = -1
    for (let px = 0; px <= 300; px += 5) {
      const p = powerFor(px, 412)
      expect(p).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })
})
