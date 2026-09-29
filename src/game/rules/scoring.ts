import { BODY_ASYK, type SimEvent, type WorldState } from '@/physics'
import { comboBonus, comboFor } from './combo'
import { returnAsykToField } from './respawn'
import type { ComboKind, RulesConfig } from './types'

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

  for (const e of events) {
    if (e.type !== 'knockOut') continue
    const body = world.bodies.find((b) => b.id === e.bodyId)
    if (!body || body.kind !== BODY_ASYK) continue
    // защита от двойного начисления: очко идёт только за асық, который
    // прямо сейчас вне кона и ещё не оплачен (правило 3)
    if (body.scored || !body.outOfField) continue
    body.scored = true
    knockedOut.push(body.id)
  }

  const combo = comboFor(knockedOut.length)
  const bonus = comboBonus(combo, rules.comboBonus)
  const sakaStoppedInside = events.some((e) => e.type === 'sakaStoppedInside')
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
