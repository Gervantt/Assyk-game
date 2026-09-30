// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: src/game/rules/scoring.ts
import { BODY_ASYK, type SimEvent, type WorldState } from '../physics/index.ts'
import { comboBonus, comboFor } from './combo.ts'
import { returnAsykToField } from './respawn.ts'
import type { ComboKind, RulesConfig } from './types.ts'

export interface ScoreOutcome {
  knockedOut: number[]
  points: number
  penalty: number
  returnedAsyk: number | null
  combo: ComboKind
  bonus: number
  sakaStoppedInside: boolean
  sakaLost: boolean
}

/**
 * Превращает события симуляции в очки. Мутирует world: ставит флаг scored,
 * чтобы один и тот же асық не принёс очко дважды (правило 3).
 *
 * Взаимодействие с правилом 5: если сақа замерла в кону, один уже оплаченный
 * асық физически возвращается в кон, и его scored сбрасывается вместе с −1 очком.
 * Счёт при этом сходится (+1 и −1 взаимно гасятся), а асық снова разыгрывается.
 */
export function scoreThrow(
  world: WorldState,
  events: SimEvent[],
  rules: RulesConfig,
  currentScore: number,
): ScoreOutcome {
  const knockedOut: number[] = []

  // Очки считаются ТОЛЬКО по финальному состоянию покоя. События knockOut
  // нужны эффектам: асық мог вылететь за линию в воздухе и вернуться обратно —
  // такой не выбит. Флаг scored защищает от повторного начисления (правило 3).
  for (const body of world.bodies) {
    if (body.kind !== BODY_ASYK) continue
    if (body.scored || !body.outOfField) continue
    body.scored = true
    knockedOut.push(body.id)
  }

  const combo = comboFor(knockedOut.length)
  const bonus = comboBonus(combo, rules.comboBonus)
  const sakaStoppedInside = events.some((e) => e.type === 'sakaRest' && e.inside)
  const sakaLost = events.some((e) => e.type === 'sakaLost')

  let penalty = 0
  let returnedAsyk: number | null = null
  if (rules.sakaInFieldPenalty && sakaStoppedInside && currentScore + knockedOut.length > 0) {
    penalty = 1
    returnedAsyk = returnAsykToField(world)
  }

  return {
    knockedOut,
    points: knockedOut.length,
    penalty,
    returnedAsyk,
    combo,
    bonus,
    sakaStoppedInside,
    sakaLost,
  }
}
