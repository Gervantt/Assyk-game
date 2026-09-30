// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: src/game/rules/combo.ts
import type { ComboKind } from './types.ts'

/** 2 асыка одним броском — «Қос!», 3+ — «Керемет!». */
export function comboFor(knockedOut: number): ComboKind {
  if (knockedOut >= 3) return 'keremet'
  if (knockedOut === 2) return 'qos'
  return null
}

/** Бонусные очки за комбо. В рейтинговых матчах правило выключено. */
export function comboBonus(kind: ComboKind, enabled: boolean): number {
  if (!enabled || kind === null) return 0
  return 1
}
