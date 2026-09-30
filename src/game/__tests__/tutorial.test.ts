import { describe, expect, it } from 'vitest'
import {
  aimFromAngles,
  BODY_ASYK,
  createWorld,
  DEFAULT_THROW_LINE_Y,
  makeThrow,
  simulate,
} from '@/physics'

/**
 * Третий шаг обучения требует реально выбить асық. Проверяем, что это
 * выполнимо тем броском, который подсказка и предлагает сделать.
 *
 * Почему тест вообще есть: угол подъёма по умолчанию когда-то брался из
 * вертикальной доли жеста, а подсказка просит «тянуть вниз». Строго
 * вертикальная тяга даёт максимальные 60° — навес, которым выбить почти
 * невозможно. Новичок делал ровно то, что написано, и застревал.
 */
const LAYOUT = { kind: 'row' as const, count: 3, fieldRadius: 1.3 }
/** Пресеты подъёма на экране обучения, градусы. */
const PRESETS = { flat: 5, mid: 25, high: 50 } as const
/** Что получается, если тянуть строго вниз без пресета. */
const STRAIGHT_PULL = 60

function knockoutsFor(elevDeg: number): number[] {
  const powers: number[] = []
  for (let yawDeg = -30; yawDeg <= 30; yawDeg += 2) {
    for (let p = 0.1; p <= 1.0001; p += 0.05) {
      const world = createWorld({ seed: 7, layout: LAYOUT })
      const aim = aimFromAngles((yawDeg * Math.PI) / 180, (elevDeg * Math.PI) / 180, p)
      const out = simulate(world, makeThrow(aim, { x: 0, y: DEFAULT_THROW_LINE_Y }))
      const knocked = out.finalState.bodies.filter((b) => b.kind === BODY_ASYK && b.outOfField)
      if (knocked.length > 0) powers.push(p)
    }
  }
  return powers
}

describe('третий шаг обучения проходим', () => {
  it('плоским броском (пресет по умолчанию) выбить легко', () => {
    const wins = knockoutsFor(PRESETS.flat)
    expect(wins.length).toBeGreaterThan(50)
    // и диапазон сил широкий: попасть можно не только одним точным значением
    expect(Math.max(...wins) - Math.min(...wins)).toBeGreaterThan(0.4)
  })

  it('средним подъёмом тоже выбивается', () => {
    expect(knockoutsFor(PRESETS.mid).length).toBeGreaterThan(20)
  })

  it('навесом в 60° выбить практически нельзя — поэтому он не по умолчанию', () => {
    // если этот порог однажды вырастет, значит физику поменяли и выбор
    // пресета по умолчанию стоит пересмотреть
    expect(knockoutsFor(STRAIGHT_PULL).length).toBeLessThan(10)
  })
})
