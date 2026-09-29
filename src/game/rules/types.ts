import type { LayoutSpec, SimResult, ThrowInput, WorldState } from '@/physics'
import type { HintKey } from './hints'
import type { WorldExtras } from './match'

export type MatchMode = 'training' | 'hotseat' | 'campaign' | 'tutorial' | 'daily'

/** Вариативные правила. В частном матче их можно переключать. */
export interface RulesConfig {
  /** сақа остановилась в кону → −1 очко и один свой асық возвращается в кон */
  sakaInFieldPenalty: boolean
  /** бонус за комбо (только одиночные режимы, в рейтинге выключен) */
  comboBonus: boolean
  /** бросков на игрока; 0 — без лимита (играем до пустого кона) */
  throwsPerPlayer: number
  /** выбил хотя бы один — бросаешь ещё раз */
  extraThrowOnKnockOut: boolean
  /** сколько асыков надо выбить; 0 — играем, пока кон не опустеет */
  goal: number
}

export type ComboKind = null | 'qos' | 'keremet'

export interface PlayerState {
  index: number
  name: string
  /** счёт = выбитые асыки минус штрафы */
  score: number
  throwsUsed: number
  /** броски, выбившие хотя бы один асық */
  hits: number
  /** лучший бросок — максимум асыков за один бросок */
  bestThrow: number
  streak: number
  bestStreak: number
  penalties: number
}

export interface ThrowSummary {
  turnNo: number
  player: number
  input: ThrowInput
  knockedOut: number[]
  points: number
  penalty: number
  returnedAsyk: number | null
  combo: ComboKind
  bonus: number
  sakaStoppedInside: boolean
  sakaLost: boolean
  hits: number
  resultHash: string
  /** совет по этому броску, выведенный из событий симуляции */
  hint: HintKey
}

export type MatchStatus = 'aiming' | 'finished'

export interface MatchState {
  mode: MatchMode
  rules: RulesConfig
  world: WorldState
  players: PlayerState[]
  currentPlayer: number
  status: MatchStatus
  turnNo: number
  history: ThrowSummary[]
  winner: number | null
  /** ничья при пустом кону — нужен решающий бросок */
  decisive: boolean
  layout: LayoutSpec
  /** препятствия, ветер и движущиеся асыки — нужны при перезапуске уровня */
  worldExtras?: WorldExtras
  seed: number
}

export interface ApplyThrowResult {
  match: MatchState
  summary: ThrowSummary
  sim: SimResult
}
