import { create } from 'zustand'
import { BODY_ASYK, type LayoutSpec, type ThrowInput } from '@/physics'
import {
  applyThrow,
  createMatch,
  starsFor,
  type MatchMode,
  type MatchState,
  type RulesConfig,
  type ThrowSummary,
  type WorldExtras,
} from '@/game/rules'
import { levelSeed, rulesFor, worldExtrasFor, type CampaignLevel } from '@/levels'
import type { DailyLevel } from '@/levels/daily'
import { knockedOutCount } from '@/game/rules'
import { activeUserId } from '@/store/useAuthStore'
import { pushProgress, recordResult } from '@/net/sync'
import { saveDaily, saveLocalDaily } from '@/net/daily'
import { beginPlayback, buildPlan, stopPlayback } from '@/game/playback'
import { freshSeed } from '@/lib/format'
import { saveBest } from '@/lib/storage'
import { useProgressStore } from '@/store/useProgressStore'
import { translate, useI18n } from '@/i18n'
import type { DictKey } from '@/i18n'
import { reducedMotion, richEffects } from '@/store/useSettings'
import { playSound, unlockAudio } from '@/audio'
import { HAPTIC, vibrate } from '@/lib/haptics'
import { resetShake } from '@/game/fx/shake'
import { awardCoins } from '@/net/shop'

export type Phase = 'aim' | 'animating' | 'finished'

export interface Toast {
  id: number
  key: DictKey
  tone: 'good' | 'bad' | 'combo'
}

export type CameraMode = 'player' | 'top'

/** Вызывается после применённого локального броска. */
export type ThrowHook = (input: ThrowInput, next: MatchState, summary: ThrowSummary) => void

/** Всё, что задаёт партию: режим, поле, правила и ограничения. */
export interface SessionConfig {
  mode: MatchMode
  layout: LayoutSpec
  rules?: Partial<RulesConfig>
  world?: WorldExtras
  playerNames?: string[]
  /** ограничение силы броска, 0..1 */
  maxPower?: number
  /** уровень кампании, если это испытание */
  level?: CampaignLevel
  /** ежедневное испытание */
  daily?: DailyLevel
  /**
   * Seed мира. Задаётся там, где раскладка обязана быть ОДИНАКОВОЙ при каждой
   * попытке: в кампании и в ежедневном испытании. От seed зависит не только
   * сторона падения асыка, но и рельеф пола, поэтому случайный seed сделал бы
   * один и тот же уровень то проходимым, то нет, а пороги звёзд — нечестными.
   */
  seed?: number
}

interface GameStore {
  session: SessionConfig | null
  match: MatchState | null
  pending: MatchState | null
  phase: Phase
  lastSummary: ThrowSummary | null
  toasts: Toast[]
  camera: CameraMode
  newRecord: boolean
  celebrate: boolean
  /** звёзды за пройденный уровень; null — уровень не пройден */
  levelStars: 1 | 2 | 3 | null

  startSession: (config: SessionConfig) => void
  start: (mode: MatchMode) => void
  startLevel: (level: CampaignLevel) => void
  startDaily: (level: DailyLevel) => void
  restart: () => void
  leave: () => void
  throwSaka: (input: ThrowInput) => void
  finishPlayback: () => void
  pushToast: (key: DictKey, tone: Toast['tone']) => void
  /** онлайн-матч подписывается сюда, чтобы отправить ход сопернику */
  setThrowHook: (fn: ThrowHook | null) => void
  /** онлайн-матч ставит сюда проверку «сейчас мой ход» */
  setTurnGuard: (fn: (() => boolean) | null) => void
  /** применить ход соперника, минуя проверку очереди */
  applyRemoteThrow: (input: ThrowInput) => string | null
  /** принять готовое состояние матча: восстановление из БД и разрешение рассинхрона */
  adoptMatch: (match: MatchState) => void
  /** Переименовать игроков, не трогая ход партии (имена приходят из профилей). */
  setPlayerNames: (names: string[]) => void
  setCamera: (c: CameraMode) => void
  dismissToast: (id: number) => void
}

let toastId = 0
let throwHook: ThrowHook | null = null
/**
 * Онлайн-матч ставит сюда проверку очереди. Это страховка второго уровня:
 * даже если интерфейс где-то пропустит бросок, он не уйдёт сопернику —
 * сервер всё равно отверг бы его, а состояния успели бы разойтись.
 */
let turnGuard: (() => boolean) | null = null

function defaultNames(mode: MatchMode): string[] {
  const locale = useI18n.getState().locale
  return mode === 'hotseat'
    ? [translate(locale, 'player.one'), translate(locale, 'player.two')]
    : [translate(locale, 'player.you')]
}

const FRESH = {
  pending: null,
  phase: 'aim' as Phase,
  lastSummary: null,
  toasts: [] as Toast[],
  newRecord: false,
  celebrate: false,
  levelStars: null,
}

export const useGameStore = create<GameStore>((set, get) => ({
  session: null,
  match: null,
  camera: 'player',
  ...FRESH,

  startSession: (config) => {
    stopPlayback()
    resetShake()
    // Локальная партия никогда не должна тащить хвост онлайн-матча: забытый
    // turnGuard заблокировал бы все броски, а throwHook отправил бы ход в чужой матч.
    throwHook = null
    turnGuard = null
    set({
      session: config,
      match: createMatch({
        mode: config.mode,
        seed: config.seed ?? freshSeed(),
        layout: config.layout,
        playerNames: config.playerNames ?? defaultNames(config.mode),
        rules: config.rules,
        world: config.world,
      }),
      ...FRESH,
    })
  },

  /**
   * Кон по умолчанию для тренировки и игры вдвоём.
   *
   * Был ряд из пяти — и это оказалось главной причиной, почему игра
   * казалась простой: ряд шириной в метр берётся сильным плоским броском
   * при ЛЮБОМ угле, замер давал 100% успеха. Круг того же размера требует
   * целиться: 64%. Сложнее, но не наказывает — по всем броскам подряд
   * успех падает с 62% до 34%.
   */
  start: (mode) =>
    get().startSession({ mode, layout: { kind: 'circle', count: 5, fieldRadius: 1.15 } }),

  startLevel: (level) =>
    get().startSession({
      mode: 'campaign',
      // рельеф и раскладка — часть уровня, а не лотерея попытки
      seed: levelSeed(level.id),
      layout: { ...level.layout },
      rules: rulesFor(level),
      world: worldExtrasFor(level),
      maxPower: level.maxPower,
      level,
    }),

  startDaily: (level) =>
    get().startSession({
      mode: 'daily',
      // у всех игроков день одинаковый — значит и мир обязан совпадать
      seed: level.seed,
      layout: { ...level.layout },
      rules: rulesFor(level),
      world: worldExtrasFor(level),
      maxPower: level.maxPower,
      daily: level,
    }),

  restart: () => {
    const s = get().session
    if (!s) return
    playSound('tap')
    get().startSession(s)
  },

  leave: () => {
    stopPlayback()
    resetShake()
    throwHook = null
    turnGuard = null
    set({ session: null, match: null, ...FRESH })
  },

  throwSaka: (input) => {
    const { match, phase } = get()
    if (!match || phase !== 'aim' || match.status === 'finished') return
    if (turnGuard && !turnGuard()) return

    unlockAudio()
    const { match: next, summary, sim } = applyThrow(match, input)

    beginPlayback(sim.frames, sim.events, buildPlan(sim.events, richEffects(), reducedMotion()))
    playSound('whoosh', { volume: 0.5 })

    set({ pending: next, phase: 'animating', lastSummary: summary, toasts: [] })
    throwHook?.(input, next, summary)
  },

  setThrowHook: (fn) => {
    throwHook = fn
  },

  setTurnGuard: (fn) => {
    turnGuard = fn
  },

  setPlayerNames: (names) => {
    const rename = (m: MatchState | null) =>
      m ? { ...m, players: m.players.map((p, i) => ({ ...p, name: names[i] ?? p.name })) } : m
    const { match, pending } = get()
    if (!match) return
    set({ match: rename(match)!, pending: rename(pending) })
  },

  adoptMatch: (match) => {
    stopPlayback()
    resetShake()
    set({
      match,
      session: { mode: match.mode, layout: match.layout, rules: match.rules },
      ...FRESH,
      phase: match.status === 'finished' ? 'finished' : 'aim',
    })
  },

  /**
   * Ход соперника: тот же simulate() на том же состоянии. Возвращает хеш
   * результата — его сверяют с присланным, чтобы поймать рассинхрон.
   */
  applyRemoteThrow: (input) => {
    const { match } = get()
    if (!match || match.status === 'finished') return null
    const { match: next, summary, sim } = applyThrow(match, input)
    beginPlayback(sim.frames, sim.events, buildPlan(sim.events, richEffects(), reducedMotion()))
    playSound('whoosh', { volume: 0.5 })
    set({ pending: next, phase: 'animating', lastSummary: summary, toasts: [] })
    return summary.resultHash
  },

  finishPlayback: () => {
    const { pending, session } = get()
    if (!pending) return
    stopPlayback()

    const summary = get().lastSummary
    const toasts: Toast[] = [...get().toasts]
    if (summary) {
      if (summary.points === 0 && !summary.sakaLost) {
        toasts.push({ id: toastId++, key: 'event.miss', tone: 'bad' })
      }
      if (summary.sakaLost) toasts.push({ id: toastId++, key: 'event.sakaLost', tone: 'bad' })
      if (summary.penalty > 0) {
        toasts.push({ id: toastId++, key: 'event.penalty', tone: 'bad' })
        playSound('penalty', { volume: 0.7 })
        vibrate(HAPTIC.penalty)
      }
    }

    const finished = pending.status === 'finished'
    const player = pending.players[0]!
    let newRecord = false
    let levelStars: 1 | 2 | 3 | null = null

    if (finished && pending.mode === 'training') {
      newRecord = saveBest('training', {
        score: player.score,
        accuracy: player.throwsUsed === 0 ? 0 : player.hits / player.throwsUsed,
        bestThrow: player.bestThrow,
        bestStreak: player.bestStreak,
      })
    }

    if (finished && pending.mode === 'campaign' && session?.level) {
      // цель достигнута, только если матч закончился до исчерпания бросков
      if (objectiveDone(pending)) {
        const stars = starsFor(player.throwsUsed, session.level.stars)
        levelStars = stars
        newRecord = useProgressStore.getState().record(session.level.id, stars, player.throwsUsed)
      }
    }

    if (finished) {
      const won = pending.mode !== 'campaign' || levelStars !== null
      playSound(won ? 'win' : 'penalty', { volume: 0.8 })
      if (won) vibrate(HAPTIC.win)
      // отправка в облако не должна задерживать показ итогов
      void syncFinished(pending, session, levelStars)
      // Тиыны за игру. Сумму всё равно проверяет и ограничивает сервер:
      // в браузере это число подменили бы.
      if (won && pending.mode !== 'tutorial') {
        const earned = player.score * 5 + (levelStars ?? 0) * 10
        if (earned > 0) void awardCoins(earned, pending.mode)
      }
    }

    set({
      match: pending,
      pending: null,
      phase: finished ? 'finished' : 'aim',
      toasts,
      newRecord,
      levelStars,
      celebrate: finished && levelStars !== null,
    })
  },

  pushToast: (key, tone) =>
    set((s) => ({ toasts: [...s.toasts.filter((t) => t.key !== key), { id: toastId++, key, tone }] })),

  setCamera: (camera) => {
    playSound('tap')
    set({ camera })
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/**
 * Фоновая отправка итогов: история, прогресс кампании, результат дня.
 * Ошибки сети сюда не пробрасываются — игра уже показала итоги.
 */
async function syncFinished(
  match: MatchState,
  session: SessionConfig | null,
  stars: 1 | 2 | 3 | null,
): Promise<void> {
  const userId = activeUserId()
  const player = match.players[0]!
  const accuracy = player.throwsUsed === 0 ? 0 : player.hits / player.throwsUsed
  const knocked = knockedOutCount(match.world)

  if (match.mode === 'daily' && session?.daily) {
    saveLocalDaily({
      date: session.daily.date,
      score: knocked,
      throws: player.throwsUsed,
      accuracy,
    })
    if (userId) {
      await saveDaily(session.daily.date, knocked, player.throwsUsed, accuracy)
      await recordResult(userId, {
        mode: 'daily',
        levelId: session.daily.id,
        score: knocked,
        throws: player.throwsUsed,
        accuracy,
      })
    }
    return
  }

  if (!userId) return

  if (match.mode === 'campaign' && session?.level) {
    await recordResult(userId, {
      mode: 'campaign',
      levelId: session.level.id,
      score: knocked,
      throws: player.throwsUsed,
      accuracy,
      stars,
    })
    if (stars !== null) await pushProgress({ [session.level.id]: { stars, bestThrows: player.throwsUsed } })
    return
  }

  if (match.mode === 'training') {
    await recordResult(userId, {
      mode: 'training',
      score: player.score,
      throws: player.throwsUsed,
      accuracy,
    })
  }
}

/** Цель уровня выполнена? Считаем по выбитым асыкам, а не по очкам. */
function objectiveDone(match: MatchState): boolean {
  const goal = match.rules.goal
  if (goal <= 0) return true
  return match.world.bodies.filter((b) => b.kind === BODY_ASYK && b.outOfField).length >= goal
}

/**
 * Отладочный доступ к состоянию партии: `?gamedebug=1` вешает на window
 * функцию, которой пользуются браузерные проверки. Без параметра ничего
 * не создаётся и в обычной игре хука нет.
 */
export function installGameDebug(): void {
  if (typeof window === 'undefined') return
  if (!new URLSearchParams(window.location.search).has('gamedebug')) return
  const w = window as unknown as { __asyqGame?: () => unknown }
  w.__asyqGame = () => {
    const s = useGameStore.getState()
    return {
      phase: s.phase,
      turnNo: s.match?.turnNo ?? null,
      status: s.match?.status ?? null,
      scores: s.match?.players.map((p) => p.score) ?? [],
      throwsUsed: s.match?.players.map((p) => p.throwsUsed) ?? [],
      lastSummary: s.lastSummary,
      inKon: s.match ? s.match.world.bodies.filter((b) => b.kind === BODY_ASYK && !b.outOfField && !b.removed).length : null,
      outOfField: s.match ? s.match.world.bodies.filter((b) => b.kind === BODY_ASYK && b.outOfField).length : null,
    }
  }
}
