import {
  createWorld,
  drawFirstByToss,
  type CreateWorldOptions,
  simulate,
  stateHash,
  type LayoutSpec,
  type SideName,
  type ThrowInput,
} from '@/physics'
import { RULES_BY_MODE } from './config'
import { hintForThrow } from './hints'
import { scoreThrow } from './scoring'
import { leader, nextPlayer, objectiveMet } from './turn'
import type {
  ApplyThrowResult,
  MatchMode,
  MatchState,
  PlayerState,
  RulesConfig,
  ThrowSummary,
} from './types'

/**
 * Очерёдность (правило 7): каждый подбрасывает сақа — той же физикой, что
 * и в игре. Выпавшая сторона решает, кто начинает (алшы > тәйкі > бүк > шік).
 * Отклонения берутся из seed матча, поэтому результат воспроизводим.
 */
export function drawFirstPlayer(
  seed: number,
  playerCount: number,
): { first: number; tosses: SideName[] } {
  const { first, tosses } = drawFirstByToss(seed, playerCount)
  return { first, tosses: tosses.map((t) => t.name) }
}

function player(index: number, name: string): PlayerState {
  return {
    index,
    name,
    score: 0,
    throwsUsed: 0,
    hits: 0,
    bestThrow: 0,
    streak: 0,
    bestStreak: 0,
    penalties: 0,
  }
}

/** Всё, что описывает мир уровня помимо раскладки асыков. */
export type WorldExtras = Pick<
  CreateWorldOptions,
  | 'obstacles'
  | 'movers'
  | 'wind'
  | 'bounceWalls'
  | 'boundsHalfWidth'
  | 'boundsHalfHeight'
  // поверхность кона задаёт уровень или его автор, но НЕ скин арены
  | 'surfaceId'
  // неровности пола: тоже часть уровня
  | 'relief'
>

export interface CreateMatchOptions {
  mode: MatchMode
  seed: number
  layout: LayoutSpec
  playerNames: string[]
  rules?: Partial<RulesConfig>
  world?: WorldExtras
  /**
   * Кто начинает. Обычно решается подбрасыванием из seed, но в сетевых матчах
   * это записано в БД при создании и является авторитетным: сервер обязан
   * поставить current_turn тому же игроку, иначе клиент и сервер разойдутся
   * с первого же хода.
   */
  first?: number
}

export function createMatch(opts: CreateMatchOptions): MatchState {
  const rules: RulesConfig = { ...RULES_BY_MODE[opts.mode], ...opts.rules }
  const players = opts.playerNames.map((n, i) => player(i, n))
  const first = opts.first ?? drawFirstPlayer(opts.seed, players.length).first
  return {
    mode: opts.mode,
    rules,
    world: createWorld({ seed: opts.seed, layout: opts.layout, ...opts.world }),
    players,
    currentPlayer: players.length > 1 ? first : 0,
    status: 'aiming',
    turnNo: 0,
    history: [],
    winner: null,
    decisive: false,
    layout: opts.layout,
    worldExtras: opts.world,
    seed: opts.seed,
  }
}

/**
 * Применяет бросок: прогоняет симуляцию, начисляет очки, двигает ход.
 * Чистая функция — возвращает новое состояние матча.
 */
export function applyThrow(match: MatchState, input: ThrowInput): ApplyThrowResult {
  if (match.status === 'finished') throw new Error('applyThrow: матч уже завершён')

  const sim = simulate(match.world, input)
  const world = sim.finalState
  const actorIndex = match.currentPlayer
  const actor = match.players[actorIndex]!

  const outcome = scoreThrow(world, sim.events, match.rules, actor.score)

  const players = match.players.map((p) => ({ ...p }))
  const me = players[actorIndex]!
  me.throwsUsed += 1
  me.score += outcome.points + outcome.bonus - outcome.penalty
  if (me.score < 0) me.score = 0
  me.penalties += outcome.penalty
  if (outcome.points > 0) {
    me.hits += 1
    me.streak += 1
    if (me.streak > me.bestStreak) me.bestStreak = me.streak
    if (outcome.points > me.bestThrow) me.bestThrow = outcome.points
  } else {
    me.streak = 0
  }

  const summary: ThrowSummary = {
    turnNo: match.turnNo + 1,
    player: actorIndex,
    input,
    knockedOut: outcome.knockedOut,
    points: outcome.points,
    penalty: outcome.penalty,
    returnedAsyk: outcome.returnedAsyk,
    combo: outcome.combo,
    bonus: outcome.bonus,
    sakaStoppedInside: outcome.sakaStoppedInside,
    sakaLost: outcome.sakaLost,
    hits: sim.events.filter((e) => e.type === 'bodyHit').length,
    resultHash: stateHash(world),
    hint: hintForThrow(world, sim.events, outcome.knockedOut.length),
  }

  const staged: MatchState = {
    ...match,
    world,
    players,
    turnNo: match.turnNo + 1,
    history: [...match.history, summary],
  }

  const done = objectiveMet(world, match.rules.goal)
  const next = nextPlayer(staged, outcome.points)
  const over = done || next === null

  if (!over) {
    return { match: { ...staged, currentPlayer: next }, summary, sim }
  }

  const win = leader(players)
  return {
    match: {
      ...staged,
      status: 'finished',
      currentPlayer: actorIndex,
      winner: win,
      decisive: players.length > 1 && win === null,
    },
    summary,
    sim,
  }
}

/** Точность игрока: доля бросков, выбивших хотя бы один асық. */
export function accuracy(p: PlayerState): number {
  return p.throwsUsed === 0 ? 0 : p.hits / p.throwsUsed
}

/** Перезапуск с тем же режимом и раскладкой, но новым seed. */
export function restartMatch(match: MatchState, seed: number): MatchState {
  return createMatch({
    mode: match.mode,
    seed,
    layout: match.layout,
    playerNames: match.players.map((p) => p.name),
    rules: match.rules,
    world: match.worldExtras,
  })
}
