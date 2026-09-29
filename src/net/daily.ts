import { backendReady, netWarn, supabase } from './supabase'
import type { DailyRow, LeaderboardRow } from './types'

const LOCAL_KEY = 'asyq.daily.v1'

export interface LocalDaily {
  date: string
  score: number
  throws: number
  accuracy: number
}

/** Локальная отметка «сегодня уже играл» — работает и без сети. */
export function loadLocalDaily(): LocalDaily | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as LocalDaily) : null
  } catch {
    return null
  }
}

export function saveLocalDaily(entry: LocalDaily): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(entry))
  } catch {
    /* приватный режим — отметка не переживёт перезагрузку */
  }
}

export async function fetchMyDaily(userId: string, date: string): Promise<DailyRow | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase
    .from('daily_results')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()
  if (error) {
    netWarn('fetchMyDaily', error)
    return null
  }
  return data as DailyRow | null
}

/**
 * Записывает зачётную попытку. Повторную сервер отвергает сам:
 * на daily_results нет политики UPDATE, а функция делает do nothing.
 * Возвращает true, только если результат действительно записан.
 */
export async function saveDaily(
  date: string,
  score: number,
  throws: number,
  accuracy: number,
): Promise<boolean> {
  if (!backendReady() || !supabase) return false
  const { data, error } = await supabase.rpc('save_daily_result', {
    p_date: date,
    p_score: score,
    p_throws: throws,
    p_accuracy: Math.min(1, Math.max(0, accuracy)),
  })
  if (error) {
    netWarn('save_daily_result', error)
    return false
  }
  return data === true
}

export async function fetchLeaderboard(date: string, limit = 50): Promise<LeaderboardRow[]> {
  if (!backendReady() || !supabase) return []
  const { data, error } = await supabase.rpc('daily_leaderboard', { p_date: date, p_limit: limit })
  if (error) {
    netWarn('daily_leaderboard', error)
    return []
  }
  return (data ?? []) as LeaderboardRow[]
}

export async function fetchMyRank(date: string): Promise<number | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.rpc('daily_rank', { p_date: date })
  if (error) {
    netWarn('daily_rank', error)
    return null
  }
  return typeof data === 'number' ? data : null
}
