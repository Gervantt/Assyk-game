import { create } from 'zustand'
import type { Frame, SimEvent, ThrowInput } from '@/physics'
import {
  applyThrow,
  createMatch,
  restartMatch,
  type MatchMode,
  type MatchState,
  type ThrowSummary,
} from '@/game/rules'
import { freshSeed } from '@/lib/format'
import { saveBest } from '@/lib/storage'
import { translate, useI18n } from '@/i18n'
import type { DictKey } from '@/i18n'

/** Фазы кадра игры. */
export type Phase = 'aim' | 'animating' | 'finished'

export interface Playback {
  frames: Frame[]
  events: SimEvent[]
  /** performance.now() в момент старта проигрывания */
  startedAt: number
}

export interface Toast {
  id: number
  key: DictKey
  tone: 'good' | 'bad' | 'combo'
}

export type CameraMode = 'player' | 'top'

interface GameStore {
  match: MatchState | null
  /** состояние, которое станет активным после проигрывания кадров */
  pending: MatchState | null
  phase: Phase
  playback: Playback | null
  lastSummary: ThrowSummary | null
  toasts: Toast[]
  camera: CameraMode
  newRecord: boolean

  start: (mode: MatchMode) => void
  restart: () => void
  leave: () => void
  throwSaka: (input: ThrowInput) => void
  finishPlayback: () => void
  setCamera: (c: CameraMode) => void
  dismissToast: (id: number) => void
}

let toastId = 0

function playerNames(mode: MatchMode): string[] {
  const locale = useI18n.getState().locale
  return mode === 'hotseat'
    ? [translate(locale, 'player.one'), translate(locale, 'player.two')]
    : [translate(locale, 'player.you')]
}

export const useGameStore = create<GameStore>((set, get) => ({
  match: null,
  pending: null,
  phase: 'aim',
  playback: null,
  lastSummary: null,
  toasts: [],
  camera: 'player',
  newRecord: false,

  start: (mode) =>
    set({
      match: createMatch({
        mode,
        seed: freshSeed(),
        layout: { kind: 'row', count: 5 },
        playerNames: playerNames(mode),
      }),
      pending: null,
      phase: 'aim',
      playback: null,
      lastSummary: null,
      toasts: [],
      newRecord: false,
    }),

  restart: () => {
    const m = get().match
    if (!m) return
    set({
      match: restartMatch(m, freshSeed()),
      pending: null,
      phase: 'aim',
      playback: null,
      lastSummary: null,
      toasts: [],
      newRecord: false,
    })
  },

  leave: () =>
    set({ match: null, pending: null, phase: 'aim', playback: null, lastSummary: null, toasts: [] }),

  throwSaka: (input) => {
    const { match, phase } = get()
    if (!match || phase !== 'aim' || match.status === 'finished') return
    const { match: next, summary, sim } = applyThrow(match, input)

    const toasts: Toast[] = []
    if (summary.combo === 'keremet') toasts.push({ id: toastId++, key: 'event.keremet', tone: 'combo' })
    else if (summary.combo === 'qos') toasts.push({ id: toastId++, key: 'event.qos', tone: 'combo' })
    else if (summary.points > 0) toasts.push({ id: toastId++, key: 'event.knock', tone: 'good' })
    else if (summary.sakaLost) toasts.push({ id: toastId++, key: 'event.sakaLost', tone: 'bad' })
    else toasts.push({ id: toastId++, key: 'event.miss', tone: 'bad' })
    if (summary.penalty > 0) toasts.push({ id: toastId++, key: 'event.penalty', tone: 'bad' })

    set({
      pending: next,
      phase: 'animating',
      playback: { frames: sim.frames, events: sim.events, startedAt: performance.now() },
      lastSummary: summary,
      toasts,
    })
  },

  finishPlayback: () => {
    const { pending } = get()
    if (!pending) return
    let newRecord = false
    if (pending.status === 'finished' && pending.mode === 'training') {
      const p = pending.players[0]!
      newRecord = saveBest('training', {
        score: p.score,
        accuracy: p.throwsUsed === 0 ? 0 : p.hits / p.throwsUsed,
        bestThrow: p.bestThrow,
        bestStreak: p.bestStreak,
      })
    }
    set({
      match: pending,
      pending: null,
      phase: pending.status === 'finished' ? 'finished' : 'aim',
      playback: null,
      newRecord,
    })
  },

  setCamera: (camera) => set({ camera }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
