// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: src/game/rules/turn.ts
import { asyksInField, BODY_ASYK, type WorldState } from '../physics/index.ts'
import type { MatchState, PlayerState, RulesConfig } from './types.ts'

/** Остались ли у игрока броски. */
export function hasThrowsLeft(p: PlayerState, rules: RulesConfig): boolean {
  return rules.throwsPerPlayer === 0 || p.throwsUsed < rules.throwsPerPlayer
}

/** Кон пуст — раунд закончен (правило 6). */
export function konIsEmpty(world: WorldState): boolean {
  return asyksInField(world).length === 0
}

/** Сколько асыков уже выбито из кона (улетевшие за пределы мира тоже считаются). */
export function knockedOutCount(world: WorldState): number {
  return world.bodies.filter((b) => b.kind === BODY_ASYK && b.outOfField).length
}

/**
 * Задача раунда выполнена. В обычной игре это пустой кон,
 * в испытании — заданное число выбитых асыков.
 */
export function objectiveMet(world: WorldState, goal: number): boolean {
  if (goal <= 0) return konIsEmpty(world)
  return knockedOutCount(world) >= goal
}

/**
 * Кто бросает следующим (правило 4: выбил — бросаешь ещё, промах — передача хода).
 * Возвращает индекс игрока или null, если бросать больше некому.
 */
export function nextPlayer(match: MatchState, knockedOut: number): number | null {
  const { players, rules, currentPlayer } = match
  const keepTurn = rules.extraThrowOnKnockOut && knockedOut > 0
  const order: number[] = []
  if (keepTurn) order.push(currentPlayer)
  for (let i = 1; i <= players.length; i++) order.push((currentPlayer + i) % players.length)
  for (const idx of order) {
    if (hasThrowsLeft(players[idx]!, rules)) return idx
  }
  return null
}

/** Победитель по счёту; null — ничья. */
export function leader(players: PlayerState[]): number | null {
  let best = players[0]!
  let tie = false
  for (const p of players.slice(1)) {
    if (p.score > best.score) {
      best = p
      tie = false
    } else if (p.score === best.score) {
      tie = true
    }
  }
  return tie ? null : best.index
}
