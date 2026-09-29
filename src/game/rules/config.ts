import type { MatchMode, RulesConfig } from './types'

export const DEFAULT_RULES: RulesConfig = {
  sakaInFieldPenalty: true,
  comboBonus: true,
  throwsPerPlayer: 5,
  extraThrowOnKnockOut: true,
}

export const RULES_BY_MODE: Record<MatchMode, RulesConfig> = {
  /** Тренировка: ровно 5 бросков, дополнительных бросков нет — считаем чистый результат. */
  training: { ...DEFAULT_RULES, throwsPerPlayer: 5, extraThrowOnKnockOut: false },
  /** Hot-seat: традиционные правила — выбил, бросаешь ещё; бонусов за комбо нет. */
  hotseat: { ...DEFAULT_RULES, throwsPerPlayer: 5, extraThrowOnKnockOut: true, comboBonus: false },
}
