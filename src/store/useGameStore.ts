import { create } from 'zustand'
import type { ThrowInput } from '@/physics'
import {
  applyThrow,
  createMatch,
  restartMatch,
  type MatchMode,
  type MatchState,
  type ThrowSummary,
} from '@/game/rules'
import { beginPlayback, stopPlayback } from '@/game/playback'
import { freshSeed } from '@/lib/format'
import { saveBest } from '@/lib/storage'
import { translate, useI18n } from '@/i18n'
import type { DictKey } from '@/i18n'
import { fullEffects } from '@/store/useSettings'
import { playSound, unlockAudio } from '@/audio'
import { HAPTIC, vibrate } from '@/lib/haptics'
import { resetShake } from '@/game/fx/shake'

/** Фазы кадра игры. */
export type Phase = 'aim' | 'animating' | 'finished'

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
  lastSummary: ThrowSummary | null
  toasts: Toast[]
  camera: CameraMode
  newRecord: boolean
  celebrate: boolean

  start: (mode: MatchMode) => void
  restart: () => void
  leave: () => void
  throwSaka: (input: ThrowInput) => void
  finishPlayback: () => void
  pushToast: (key: DictKey, tone: Toast['tone']) => void
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

const FRESH = {
  pending: null,
  phase: 'aim' as Phase,
  lastSummary: null,
  toasts: [] as Toast[],
  newRecord: false,
  celebrate: false,
}

export const useGameStore = create<GameStore>((set, get) => ({
  match: null,
  camera: 'player',
  ...FRESH,

  start: (mode) => {
    stopPlayback()
    resetShake()
    set({
      match: createMatch({
        mode,
        seed: freshSeed(),
        layout: { kind: 'row', count: 5 },
        playerNames: playerNames(mode),
      }),
      ...FRESH,
    })
  },

  restart: () => {
    const m = get().match
    if (!m) return
    stopPlayback()
    resetShake()
    playSound('tap')
    set({ match: restartMatch(m, freshSeed()), ...FRESH })
  },

  leave: () => {
    stopPlayback()
    resetShake()
    set({ match: null, ...FRESH })
  },

  throwSaka: (input) => {
    const { match, phase } = get()
    if (!match || phase !== 'aim' || match.status === 'finished') return

    unlockAudio()
    const { match: next, summary, sim } = applyThrow(match, input)

    beginPlayback(sim.frames, sim.events, fullEffects())
    playSound('whoosh', { volume: 0.5 })

    set({ pending: next, phase: 'animating', lastSummary: summary, toasts: [] })
  },

  finishPlayback: () => {
    const { pending } = get()
    if (!pending) return
    stopPlayback()

    const summary = get().lastSummary
    // надписи, набранные во время броска («Қос!», «+1»), не сбрасываем —
    // иначе крупный текст комбо обрывался бы ровно в момент остановки тел
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

    let newRecord = false
    const finished = pending.status === 'finished'
    if (finished && pending.mode === 'training') {
      const p = pending.players[0]!
      newRecord = saveBest('training', {
        score: p.score,
        accuracy: p.throwsUsed === 0 ? 0 : p.hits / p.throwsUsed,
        bestThrow: p.bestThrow,
        bestStreak: p.bestStreak,
      })
    }
    if (finished) {
      playSound('win', { volume: 0.8 })
      vibrate(HAPTIC.win)
    }

    set({
      match: pending,
      pending: null,
      phase: finished ? 'finished' : 'aim',
      toasts,
      newRecord,
      celebrate: finished,
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
