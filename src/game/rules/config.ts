import type { MatchMode, RulesConfig } from './types'

export const DEFAULT_RULES: RulesConfig = {
  sakaInFieldPenalty: true,
  comboBonus: true,
  throwsPerPlayer: 5,
  extraThrowOnKnockOut: true,
  goal: 0,
}

export const RULES_BY_MODE: Record<MatchMode, RulesConfig> = {
  /** Тренировка: ровно 5 бросков, дополнительных бросков нет — считаем чистый результат. */
  training: { ...DEFAULT_RULES, throwsPerPlayer: 5, extraThrowOnKnockOut: false },
  /** Hot-seat: традиционные правила — выбил, бросаешь ещё; бонусов за комбо нет. */
  hotseat: { ...DEFAULT_RULES, throwsPerPlayer: 5, extraThrowOnKnockOut: true, comboBonus: false },
  /** Кампания: бюджет бросков фиксирован, каждый бросок на счету. */
  campaign: { ...DEFAULT_RULES, throwsPerPlayer: 3, extraThrowOnKnockOut: false, comboBonus: false },
  /** Ежедневное испытание: те же правила, что в кампании, одна зачётная попытка. */
  daily: { ...DEFAULT_RULES, throwsPerPlayer: 5, extraThrowOnKnockOut: false, comboBonus: false },
  /** Обучение: провалить нельзя — бросков сколько угодно, штрафов нет. */
  tutorial: {
    ...DEFAULT_RULES,
    throwsPerPlayer: 0,
    extraThrowOnKnockOut: false,
    comboBonus: false,
    sakaInFieldPenalty: false,
  },
}
