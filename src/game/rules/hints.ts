import { BODY_ASYK, BODY_SAKA, fieldContains, type SimEvent, type WorldState } from '@/physics'

/**
 * Советы после неудачного броска. Выводятся ТОЛЬКО из событий симуляции
 * и итогового положения тел — никаких догадок про намерение игрока.
 */
export type HintKey =
  | 'hint.overshoot'
  | 'hint.undershoot'
  | 'hint.wide'
  | 'hint.weak'
  | 'hint.sakaInside'
  | 'hint.timing'
  | 'hint.almost'
  | 'hint.good'

export function hintForThrow(world: WorldState, events: SimEvent[]): HintKey {
  const saka = world.bodies.find((b) => b.kind === BODY_SAKA)
  const asykIds = new Set(world.bodies.filter((b) => b.kind === BODY_ASYK).map((b) => b.id))

  const knocked = events.filter((e) => e.type === 'knockOut').length
  const sakaHitAsyk = events.some(
    (e) => e.type === 'hit' && ((e.a === 0 && asykIds.has(e.b)) || (e.b === 0 && asykIds.has(e.a))),
  )
  const lost = events.some((e) => e.type === 'sakaLost')
  const stoppedInside = events.some((e) => e.type === 'sakaStoppedInside')

  if (knocked > 0) return stoppedInside ? 'hint.sakaInside' : 'hint.good'
  if (lost) return 'hint.overshoot'
  if (sakaHitAsyk) return 'hint.weak'

  // Недолёт — это «встал перед коном», а не «улетел вбок и тоже не дошёл
  // по вертикали», поэтому проверяем ещё и поперечное отклонение.
  if (saka && saka.y < world.field.cy - world.field.radius) {
    const offAxis = Math.abs(saka.x - world.field.cx)
    if (offAxis <= world.field.radius + 0.5) return 'hint.undershoot'
    return 'hint.wide'
  }
  // в кон заехали, но никого не задели
  if (world.movers.length > 0) return 'hint.timing'
  if (saka && fieldContains(world.field, saka.x, saka.y)) return 'hint.sakaInside'
  return 'hint.wide'
}

/** Самый частый совет за уровень — по нему и подсказываем, что исправить. */
export function dominantHint(hints: HintKey[]): HintKey | null {
  const useful = hints.filter((h) => h !== 'hint.good')
  if (useful.length === 0) return null
  const count = new Map<HintKey, number>()
  for (const h of useful) count.set(h, (count.get(h) ?? 0) + 1)
  let best: HintKey = useful[useful.length - 1]!
  let bestN = 0
  for (const [h, n] of count) {
    // при равенстве побеждает более поздний совет: он про последний бросок
    if (n > bestN) {
      best = h
      bestN = n
    }
  }
  return best
}

/** Звёзды за экономию бросков: [на 3 звезды, на 2 звезды]. */
export function starsFor(throwsUsed: number, thresholds: readonly [number, number]): 1 | 2 | 3 {
  if (throwsUsed <= thresholds[0]) return 3
  if (throwsUsed <= thresholds[1]) return 2
  return 1
}
