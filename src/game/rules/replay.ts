import { stateHash, type ThrowInput } from '@/physics'
import { applyThrow, createMatch } from './match'
import type { MatchState } from './types'

/**
 * Настройки сетевого матча — ровно то, что лежит в matches.rules.
 * Клиент и Edge Function собирают партию из них одинаково: любое расхождение
 * здесь означало бы, что сервер посчитает не тот результат, который видели
 * игроки.
 */
export interface OnlineRules {
  first: number
  layout: {
    kind: string
    count: number
    fieldRadius?: number
    shape?: string
    positions?: Array<{ x: number; y: number }>
  }
  sakaInFieldPenalty: boolean
  throwsPerPlayer: number
  /** камни-препятствия выбранной карты */
  stones?: Array<{ x: number; y: number; radius: number }>
  /** неровности пола, м */
  relief?: number
  mapId?: string
}

/**
 * В сетевых матчах ход переходит после КАЖДОГО броска. Правило 4
 * («выбил — бросай ещё») традиционное, но на двух устройствах меткий игрок
 * вымел бы весь кон, а соперник просидел бы партию, не бросив ни разу.
 */
export const ONLINE_EXTRA_THROW = false

/** Стартовое состояние сетевого матча. Одинаково на клиенте и на сервере. */
export function buildOnlineMatch(
  seed: number,
  rules: OnlineRules,
  playerNames: string[],
): MatchState {
  return createMatch({
    mode: 'hotseat',
    seed,
    first: rules.first,
    layout: rules.layout as never,
    playerNames,
    rules: {
      throwsPerPlayer: rules.throwsPerPlayer,
      sakaInFieldPenalty: rules.sakaInFieldPenalty,
      extraThrowOnKnockOut: ONLINE_EXTRA_THROW,
      comboBonus: false,
      goal: 0,
    },
    // Камни и рельеф — часть карты. Сервер переигрывает матч этим же кодом,
    // поэтому они обязаны попасть в мир и на клиенте, и при пересчёте ELO.
    world: { obstacles: rules.stones ?? [], relief: rules.relief },
  })
}

export interface ReplayResult {
  match: MatchState
  /** хеш состояния после каждого хода — сверяется с moves.result_hash */
  hashes: string[]
  /** ход, на котором хеш разошёлся с записанным; null — всё сошлось */
  mismatchAt: number | null
}

/**
 * Переигрывает матч с нуля по списку бросков. Это и есть защита от подмены
 * результата: рейтинг начисляется по итогу пересчёта, а не по тому, что
 * прислал клиент.
 */
export function replayMatch(
  seed: number,
  rules: OnlineRules,
  moves: Array<{ input: ThrowInput; result_hash?: string }>,
  playerNames: string[] = ['1', '2'],
): ReplayResult {
  let match = buildOnlineMatch(seed, rules, playerNames)
  const hashes: string[] = []
  let mismatchAt: number | null = null

  for (let i = 0; i < moves.length; i++) {
    if (match.status === 'finished') break
    match = applyThrow(match, moves[i]!.input).match
    const hash = stateHash(match.world)
    hashes.push(hash)
    const claimed = moves[i]!.result_hash
    if (mismatchAt === null && claimed && claimed !== hash) mismatchAt = i + 1
  }

  return { match, hashes, mismatchAt }
}
