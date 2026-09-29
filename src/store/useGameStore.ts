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
import { rulesFor, worldExtrasFor, type CampaignLevel } from '@/levels'
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

export type Phase = 'aim' | 'animating' | 'finished'

export interface Toast {
  id: number
  key: DictKey
  tone: 'good' | 'bad' | 'combo'
}

export type CameraMode = 'player' | 'top'

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
  setCamera: (c: CameraMode) => void
  dismissToast: (id: number) => void
}

let toastId = 0

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
    set({
      session: config,
      match: createMatch({
        mode: config.mode,
        seed: freshSeed(),
        layout: config.layout,
        playerNames: config.playerNames ?? defaultNames(config.mode),
        rules: config.rules,
        world: config.world,
      }),
      ...FRESH,
    })
  },

  start: (mode) => get().startSession({ mode, layout: { kind: 'row', count: 5 } }),

  startLevel: (level) =>
    get().startSession({
      mode: 'campaign',
      layout: { ...level.layout },
      rules: rulesFor(level),
      world: worldExtrasFor(level),
      maxPower: level.maxPower,
      level,
    }),

  startDaily: (level) =>
    get().startSession({
      mode: 'daily',
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
    set({ session: null, match: null, ...FRESH })
  },

  throwSaka: (input) => {
    const { match, phase } = get()
    if (!match || phase !== 'aim' || match.status === 'finished') return

    unlockAudio()
    const { match: next, summary, sim } = applyThrow(match, input)

    beginPlayback(sim.frames, sim.events, buildPlan(sim.events, richEffects(), reducedMotion()))
    playSound('whoosh', { volume: 0.5 })

    set({ pending: next, phase: 'animating', lastSummary: summary, toasts: [] })
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
