import { create } from 'zustand'
import { drawFirstPlayer, buildOnlineMatch, type MatchState } from '@/game/rules'
import { stateHash } from '@/physics'
import { freshSeed } from '@/lib/format'
import {
  createMatch as createMatchRow,
  fetchSnapshot,
  joinMatch,
  submitMove,
  subscribeToMatch,
  type MatchPlayer,
  type MatchRow,
  type MatchRules,
  type MoveRow,
} from '@/net/match'
import { currentUserId } from '@/net/auth'
import { useGameStore } from './useGameStore'
import { useI18n, translate } from '@/i18n'

export type OnlineStatus = 'idle' | 'connecting' | 'waiting' | 'playing' | 'finished' | 'error'

const LAYOUT = { kind: 'row' as const, count: 5, fieldRadius: 0.93 }
const THROWS = 5
interface MatchStore {
  status: OnlineStatus
  matchId: string | null
  myId: string | null
  row: MatchRow | null
  players: MatchPlayer[]
  /** соперник сейчас на странице */
  opponentOnline: boolean
  /** сколько раз состояния разошлись — видно на экране, не прячем */
  desyncs: number
  error: string | null

  /** создать матч и получить ссылку */
  host: () => Promise<string | null>
  /** открыть матч по ссылке */
  open: (matchId: string) => Promise<void>
  leave: () => void
}

let unsubscribe: (() => void) | null = null
/** Счётчики для отладки синхронизации: сколько чужих ходов пришло и применилось. */
export const syncCounters = { received: 0, applied: 0, skipped: 0, own: 0 }
/** ходы, которые мы применили сами: не проигрывать их второй раз из Realtime */
const appliedTurns = new Set<number>()

function namesFor(players: MatchPlayer[], row: MatchRow): string[] {
  const locale = useI18n.getState().locale
  const name = (id: string | null, slot: number) => {
    if (!id) return translate(locale, 'online.slotEmpty')
    const found = players.find((p) => p.id === id)?.username
    return found ?? translate(locale, 'online.playerN', { n: String(slot + 1) })
  }
  return [name(row.player1, 0), name(row.player2, 1)]
}

/**
 * Собирает локальный матч из строки БД: состояние или чистый старт по seed.
 * Имена в сохранённом состоянии заведомо устаревшие (создатель записал его до
 * того, как соперник вступил), поэтому ВСЕГДА берём их из профилей заново.
 */
function restore(row: MatchRow, players: MatchPlayer[]): MatchState {
  const names = namesFor(players, row)
  const withNames = (m: MatchState): MatchState => ({
    ...m,
    players: m.players.map((p, i) => ({ ...p, name: names[i] ?? p.name })),
  })
  if (row.state) return withNames(row.state)
  return buildOnlineMatch(row.seed, row.rules, names)
}

/** Подтянуть свежие имена в идущую партию (соперник вступил / профили дозагрузились). */
function refreshNames(players: MatchPlayer[], row: MatchRow | null): void {
  if (!row) return
  useGameStore.getState().setPlayerNames(namesFor(players, row))
}

export const useMatchStore = create<MatchStore>((set, get) => ({
  status: 'idle',
  matchId: null,
  myId: null,
  row: null,
  players: [],
  opponentOnline: false,
  desyncs: 0,
  error: null,

  host: async () => {
    set({ status: 'connecting', error: null })
    const myId = await currentUserId()
    if (!myId) {
      set({ status: 'error', error: 'offline' })
      return null
    }

    const seed = freshSeed()
    const { first } = drawFirstPlayer(seed, 2)
    const rules: MatchRules = {
      first,
      layout: LAYOUT,
      sakaInFieldPenalty: true,
      throwsPerPlayer: THROWS,
    }
    // Имена здесь заведомо неизвестны: соперник ещё не открыл ссылку.
    // Они не хранятся в состоянии — restore() всегда берёт их из профилей.
    const state = buildOnlineMatch(seed, rules, ['', ''])

    const row = await createMatchRow(seed, rules, state)
    if (!row) {
      set({ status: 'error', error: 'create' })
      return null
    }
    set({ matchId: row.id, myId })
    return row.id
  },

  open: async (matchId) => {
    get().leave()
    set({ status: 'connecting', matchId, error: null, desyncs: 0 })

    const myId = await currentUserId()
    if (!myId) {
      set({ status: 'error', error: 'offline' })
      return
    }

    const joined = await joinMatch(matchId)
    if (!joined) {
      set({ status: 'error', error: 'join' })
      return
    }

    const snapshot = await fetchSnapshot(matchId)
    const row = snapshot?.match ?? joined
    const players = snapshot?.players ?? []
    appliedTurns.clear()
    for (const m of snapshot?.moves ?? []) appliedTurns.add(m.turn_no)

    const local = restore(row, players)
    useGameStore.getState().adoptMatch(local)
    refreshNames(players, row)

    set({
      myId,
      row,
      players,
      status: row.status === 'waiting' ? 'waiting' : row.status === 'finished' ? 'finished' : 'playing',
    })

    // локальный бросок уходит сопернику
    useGameStore.getState().setThrowHook((input, next, summary) => {
      const state = get()
      if (!state.row || !state.myId) return
      appliedTurns.add(next.turnNo)
      const nextTurnIndex = next.currentPlayer
      const nextTurnId = nextTurnIndex === 0 ? state.row.player1 : state.row.player2
      const finished = next.status === 'finished'
      // очередь переключаем немедленно: ждать ответа Realtime нельзя,
      // иначе в этом окне можно успеть бросить второй раз
      if (state.row) set({ row: { ...state.row, current_turn: finished ? null : nextTurnId } })
      void submitMove({
        matchId,
        turnNo: next.turnNo,
        input,
        resultHash: summary.resultHash,
        state: next,
        nextTurn: finished ? null : nextTurnId,
        status: finished ? 'finished' : 'playing',
        winner: finished && next.winner !== null
          ? next.winner === 0
            ? state.row.player1
            : state.row.player2
          : null,
      }).then((updated) => {
        // сервер — источник истины по очереди
        if (updated) set({ row: updated })
      })
    })

    // бросок вне очереди не должен доходить до симуляции
    useGameStore.getState().setTurnGuard(() => {
      const state = get()
      return Boolean(state.row && state.myId && state.row.current_turn === state.myId)
    })

    unsubscribe = subscribeToMatch(matchId, myId, {
      onMove: (move) => void handleRemoteMove(move, set, get),
      onMatch: (updated) => {
        set({
          row: updated,
          status:
            updated.status === 'waiting'
              ? 'waiting'
              : updated.status === 'finished'
                ? 'finished'
                : 'playing',
        })
        // соперник вступил — подтянем имена
        if (updated.player2 && get().players.length < 2) {
          void fetchSnapshot(matchId).then((s) => {
            if (!s) return
            set({ players: s.players })
            refreshNames(s.players, get().row)
          })
        } else {
          refreshNames(get().players, updated)
        }
      },
      onPresence: (ids) => set({ opponentOnline: ids.some((id) => id !== myId) }),
    })
  },

  leave: () => {
    unsubscribe?.()
    unsubscribe = null
    appliedTurns.clear()
    useGameStore.getState().setThrowHook(null)
    useGameStore.getState().setTurnGuard(null)
    set({ status: 'idle', matchId: null, row: null, players: [], opponentOnline: false })
  },
}))

/**
 * Ход соперника. Прогоняем ТОТ ЖЕ simulate() на своём состоянии и сверяем
 * хеш. Сошлось — играем анимацию у себя. Разошлось — берём авторитетное
 * состояние из БД и считаем рассинхрон.
 */
async function handleRemoteMove(
  move: MoveRow,
  set: (patch: Partial<MatchStore>) => void,
  get: () => MatchStore,
): Promise<void> {
  const { myId, matchId } = get()
  if (!myId || !matchId) return
  syncCounters.received++
  if (move.player_id === myId) {
    syncCounters.own++
    return
  }
  if (appliedTurns.has(move.turn_no)) {
    syncCounters.skipped++
    return
  }
  appliedTurns.add(move.turn_no)
  syncCounters.applied++

  const localHash = useGameStore.getState().applyRemoteThrow(move.input)
  if (localHash && localHash === move.result_hash) return

  // расхождение: авторитет — состояние в базе
  console.warn('[match] рассинхрон', { turn: move.turn_no, local: localHash, remote: move.result_hash })
  set({ desyncs: get().desyncs + 1 })
  const snapshot = await fetchSnapshot(matchId)
  if (snapshot?.match.state) {
    useGameStore.getState().adoptMatch(snapshot.match.state)
    set({ row: snapshot.match, players: snapshot.players })
  }
}

/** Хеш локального состояния — для отладочной плашки. */
export function localStateHash(): string | null {
  const m = useGameStore.getState().match
  return m ? stateHash(m.world) : null
}

/**
 * ?matchdebug=1 открывает наружу хеш и счёт: так синхронизацию двух
 * клиентов можно сверять точно, а не на глаз. В обычной игре не создаётся.
 */
export function installMatchDebug(): void {
  if (typeof window === 'undefined') return
  if (!new URLSearchParams(window.location.search).has('matchdebug')) return
  const w = window as unknown as { __asyqMatch?: () => unknown }
  w.__asyqMatch = () => {
    const game = useGameStore.getState()
    const online = useMatchStore.getState()
    return {
      hash: localStateHash(),
      turnNo: game.match?.turnNo ?? null,
      scores: game.match?.players.map((p) => p.score) ?? [],
      currentPlayer: game.match?.currentPlayer ?? null,
      status: online.status,
      sync: { ...syncCounters },
      myId: online.myId,
      currentTurnId: online.row?.current_turn ?? null,
      opponentOnline: online.opponentOnline,
      desyncs: online.desyncs,
      phase: game.phase,
    }
  }
}
