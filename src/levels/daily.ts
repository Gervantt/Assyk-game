import { rngIntAt, seedFromString } from '@/physics'
import type { LevelDef, LevelLayout } from './types'

/**
 * Ежедневное испытание. Раскладка и seed выводятся ТОЛЬКО из даты,
 * поэтому у всех игроков в мире один и тот же кон в один и тот же день.
 * Дата берётся по UTC, иначе у соседних часовых поясов были бы разные испытания.
 */

export const DAILY_THROWS = 5

export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function dailySeed(dateISO: string): number {
  return seedFromString(`asyq-daily-${dateISO}`)
}

const KINDS = ['row', 'pyramid', 'circle', 'square'] as const
/** Модификатор дня: от простого кона до ветра и препятствий. */
const MODIFIERS = ['plain', 'plain', 'stones', 'wind', 'movers'] as const

export interface DailyLevel extends LevelDef {
  date: string
  modifier: (typeof MODIFIERS)[number]
}

export function dailyLevel(dateISO: string = todayISO()): DailyLevel {
  const seed = dailySeed(dateISO)

  const kind = KINDS[rngIntAt(seed, 1, KINDS.length)]!
  const count = 5 + rngIntAt(seed, 2, 4)
  const fieldRadius = 1.1 + rngIntAt(seed, 3, 4) * 0.06
  const shape = rngIntAt(seed, 4, 4) === 0 ? 'square' : 'circle'
  const modifier = MODIFIERS[rngIntAt(seed, 5, MODIFIERS.length)]!

  const layout: LevelLayout = { kind, count, fieldRadius, shape }
  const level: DailyLevel = {
    id: `daily-${dateISO}`,
    date: dateISO,
    modifier,
    layout,
    throws: DAILY_THROWS,
    // цель — весь кон: счётом считается, сколько успел выбить за пять бросков
    goal: count,
    stars: [2, 4],
    penalty: true,
  }

  if (modifier === 'stones') {
    const side = 0.55 + rngIntAt(seed, 6, 4) * 0.08
    level.obstacles = [
      { x: -side, y: -1.35, radius: 0.24 },
      { x: side, y: -1.35, radius: 0.24 },
    ]
  } else if (modifier === 'wind') {
    const dir = rngIntAt(seed, 7, 2) === 0 ? -1 : 1
    level.wind = { x: dir * (0.5 + rngIntAt(seed, 8, 4) * 0.12), y: 0 }
  } else if (modifier === 'movers') {
    level.layout = { ...layout, count: Math.max(2, count - 2) }
    level.movers = [
      { x: 0, y: 0.5, axis: 'x', amplitude: 0.5, periodSec: 1.8 + rngIntAt(seed, 9, 4) * 0.2 },
    ]
    level.goal = level.layout.count + 1
  }

  return level
}
