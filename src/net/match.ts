import { stateHash, type ThrowInput } from '@/physics'
import type { MatchState } from '@/game/rules'
import { backendReady, netWarn, supabase } from './supabase'

/**
 * Матч с другом по ссылке. По сети ходит только ThrowInput и хеш результата:
 * оба клиента прогоняют один и тот же simulate() и сверяют хеши. Полное
 * состояние лежит в matches.state и служит авторитетом при расхождении
 * и при восстановлении после перезагрузки.
 */

export interface MatchRow {
  id: string
  mode: string
  seed: number
  rules: MatchRules
  status: 'waiting' | 'playing' | 'finished' | 'abandoned'
  player1: string
  player2: string | null
  current_turn: string | null
  state: MatchState | null
  state_hash: string | null
  winner: string | null
}

export interface MoveRow {
  id: string
  match_id: string
  player_id: string
  turn_no: number
  input: ThrowInput
  result_hash: string
  created_at: string
}

export interface MatchPlayer {
  id: string
  username: string
  avatar: string
}

/** Всё, что нужно для восстановления матча из базы. */
export interface MatchSnapshot {
  match: MatchRow
  moves: MoveRow[]
  players: MatchPlayer[]
}

/** Настройки партии кладём в rules: приглашённый собирает по ним тот же мир. */
export interface MatchRules {
  /** кто начинает: 0 — создатель, 1 — приглашённый; решено подбрасыванием */
  first: number
  layout: {
    kind: string
    count: number
    fieldRadius?: number
    shape?: string
    /** явные позиции: кон из редактора испытаний */
    positions?: Array<{ x: number; y: number }>
  }
  sakaInFieldPenalty: boolean
  throwsPerPlayer: number
  /** камни-препятствия выбранной карты */
  stones?: Array<{ x: number; y: number; radius: number }>
  /** неровности пола выбранной карты, м */
  relief?: number
  /** id карты или пользовательского испытания — только для показа */
  mapId?: string
}

export async function createMatch(
  seed: number,
  rules: MatchRules,
  state: MatchState,
): Promise<MatchRow | null> {
  if (!backendReady() || !supabase) return null
  const { data: session } = await supabase.auth.getSession()
  const me = session.session?.user.id
  if (!me) return null

  const { data, error } = await supabase
    .from('matches')
    .insert({
      mode: 'friend',
      seed,
      rules,
      status: 'waiting',
      player1: me,
      current_turn: null,
      state,
      state_hash: stateHash(state.world),
    })
    .select()
    .single()

  if (error) {
    netWarn('createMatch', error)
    return null
  }
  return data as MatchRow
}

/** Вступление по ссылке. Создателю вернёт его же матч. */
export async function joinMatch(matchId: string): Promise<MatchRow | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.rpc('join_match', { p_match_id: matchId })
  if (error) {
    netWarn('join_match', error)
    return null
  }
  return data as MatchRow
}

export async function fetchSnapshot(matchId: string): Promise<MatchSnapshot | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.rpc('match_snapshot', { p_match_id: matchId })
  if (error) {
    netWarn('match_snapshot', error)
    return null
  }
  return data as MatchSnapshot
}

export interface SubmitMoveArgs {
  matchId: string
  turnNo: number
  input: ThrowInput
  resultHash: string
  state: MatchState
  nextTurn: string | null
  status: 'playing' | 'finished'
  winner: string | null
}

export async function submitMove(args: SubmitMoveArgs): Promise<MatchRow | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.rpc('submit_move', {
    p_match_id: args.matchId,
    p_turn_no: args.turnNo,
    p_input: args.input,
    p_result_hash: args.resultHash,
    p_state: args.state,
    p_state_hash: stateHash(args.state.world),
    p_next_turn: args.nextTurn,
    p_status: args.status,
    p_winner: args.winner,
  })
  if (error) {
    netWarn('submit_move', error)
    return null
  }
  return data as MatchRow
}

export interface MatchChannelHandlers {
  onMove: (move: MoveRow) => void
  onMatch: (match: MatchRow) => void
  onPresence: (onlineIds: string[]) => void
}

/**
 * Подписка на матч: чужие ходы, изменения самого матча и присутствие
 * соперника. Возвращает функцию отписки.
 */
export function subscribeToMatch(
  matchId: string,
  myId: string,
  handlers: MatchChannelHandlers,
): () => void {
  if (!backendReady() || !supabase) return () => {}
  const client = supabase

  const channel = client
    .channel(`match:${matchId}`, { config: { presence: { key: myId } } })
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'moves', filter: `match_id=eq.${matchId}` },
      (payload) => handlers.onMove(payload.new as MoveRow),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
      (payload) => handlers.onMatch(payload.new as MatchRow),
    )
    .on('presence', { event: 'sync' }, () => {
      handlers.onPresence(Object.keys(channel.presenceState()))
    })

  void channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') void channel.track({ at: Date.now() })
  })

  return () => {
    void client.removeChannel(channel)
  }
}
