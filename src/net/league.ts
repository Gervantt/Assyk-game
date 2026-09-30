import { backendReady, netWarn, supabase } from './supabase'

export interface LeagueRow {
  university_id: string
  name: string
  city: string
  students: number
  daily_points: number
  ranked_wins: number
  points: number
}

/** Понедельник недели, к которой относится дата (неделя считается с понедельника). */
export function weekStart(d = new Date()): string {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const shift = (x.getUTCDay() + 6) % 7
  x.setUTCDate(x.getUTCDate() - shift)
  return x.toISOString().slice(0, 10)
}

export async function fetchLeague(week: string): Promise<LeagueRow[]> {
  if (!backendReady() || !supabase) return []
  const { data, error } = await supabase.rpc('university_league', { p_week_start: week })
  if (error) {
    netWarn('fetchLeague', error)
    return []
  }
  return (data as LeagueRow[]) ?? []
}
