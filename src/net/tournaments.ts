import { backendReady, netWarn, supabase } from './supabase'

export interface TournamentRow {
  id: string
  owner_id: string
  title: string
  size: number
  rules: { throwsPerPlayer?: number; sakaInFieldPenalty?: boolean }
  bracket: BracketRound[]
  status: 'draft' | 'open' | 'running' | 'finished'
  created_at: string
}

export interface BracketPair {
  a: string | null
  b: string | null
  match: string | null
  winner: string | null
}

export type BracketRound = BracketPair[]

export interface TournamentPlayer {
  id: string
  username: string
  seed_no: number
}

export interface TournamentView {
  tournament: TournamentRow
  players: TournamentPlayer[]
}

export async function createTournament(
  title: string,
  size: 4 | 8,
  rules: TournamentRow['rules'],
): Promise<TournamentRow | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.rpc('create_tournament', {
    p_title: title,
    p_size: size,
    p_rules: rules,
  })
  if (error) {
    netWarn('createTournament', error)
    return null
  }
  return data as TournamentRow
}

export async function joinTournament(id: string): Promise<boolean> {
  if (!backendReady() || !supabase) return false
  const { error } = await supabase.rpc('join_tournament', { p_id: id })
  if (error) {
    netWarn('joinTournament', error)
    return false
  }
  return true
}

export async function startTournament(id: string): Promise<boolean> {
  if (!backendReady() || !supabase) return false
  const { error } = await supabase.rpc('start_tournament', { p_id: id })
  if (error) {
    netWarn('startTournament', error)
    return false
  }
  return true
}

/** Продвигает победителей. Победителя берёт из matches, а не со слов клиента. */
export async function advanceTournament(id: string): Promise<void> {
  if (!backendReady() || !supabase) return
  const { error } = await supabase.rpc('advance_tournament', { p_id: id })
  if (error) netWarn('advanceTournament', error)
}

export async function fetchTournament(id: string): Promise<TournamentView | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.rpc('tournament_view', { p_id: id })
  if (error) {
    netWarn('fetchTournament', error)
    return null
  }
  return (data as TournamentView | null) ?? null
}

/** Турниры, в которых я участвую. */
export async function myTournaments(userId: string): Promise<TournamentRow[]> {
  if (!backendReady() || !supabase) return []
  const { data, error } = await supabase
    .from('tournament_players')
    .select('tournament_id, tournaments(*)')
    .eq('user_id', userId)
  if (error) {
    netWarn('myTournaments', error)
    return []
  }
  // PostgREST разворачивает связь массивом, даже когда она «одна к одной»
  return (data as unknown as Array<{ tournaments: TournamentRow | TournamentRow[] | null }>)
    .flatMap((r) => (Array.isArray(r.tournaments) ? r.tournaments : r.tournaments ? [r.tournaments] : []))
}

export function tournamentUrl(id: string): string {
  return `${window.location.origin}/t/${id}`
}
