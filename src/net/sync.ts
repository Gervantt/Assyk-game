import { backendReady, netWarn, supabase } from './supabase'
import { loadProgress, mergeProgress, type ProgressMap } from '@/lib/progress'
import type { ProgressRow, ResultMode, ResultRow } from './types'

/**
 * Синхронизация прогресса. Локальное хранилище остаётся источником правды
 * для геймплея: сеть может отвалиться в любой момент, и игра не должна ждать.
 */

/** Заливает локальный прогресс на сервер. Рекорд там только улучшается. */
export async function pushProgress(progress: ProgressMap = loadProgress()): Promise<number> {
  if (!backendReady() || !supabase) return 0
  const entries = Object.entries(progress)
  let sent = 0
  for (const [levelId, p] of entries) {
    const { error } = await supabase.rpc('save_progress', {
      p_level_id: levelId,
      p_stars: p.stars,
      p_best_throws: p.bestThrows,
    })
    if (error) {
      netWarn('save_progress', error)
      break
    }
    sent++
  }
  return sent
}

export async function pullProgress(userId: string): Promise<ProgressMap> {
  if (!backendReady() || !supabase) return {}
  const { data, error } = await supabase
    .from('progress')
    .select('level_id, stars, best_throws')
    .eq('user_id', userId)
  if (error) {
    netWarn('pullProgress', error)
    return {}
  }
  const remote: ProgressMap = {}
  for (const row of (data ?? []) as Pick<ProgressRow, 'level_id' | 'stars' | 'best_throws'>[]) {
    remote[row.level_id] = {
      stars: Math.min(3, Math.max(1, row.stars)) as 1 | 2 | 3,
      bestThrows: row.best_throws,
    }
  }
  return remote
}

/**
 * Полный обмен: сначала отдаём своё, потом забираем серверное и сводим
 * с локальным по лучшему результату. Прогресс гостя так переносится
 * в аккаунт и открывается на другом устройстве.
 */
export async function syncProgress(userId: string): Promise<ProgressMap> {
  await pushProgress()
  const remote = await pullProgress(userId)
  return mergeProgress(remote)
}

export interface ResultInput {
  mode: ResultMode
  levelId?: string | null
  score: number
  throws: number
  accuracy: number
  stars?: 1 | 2 | 3 | null
}

/** Запись в историю результатов. Тихо ничего не делает без сессии. */
export async function recordResult(userId: string, r: ResultInput): Promise<void> {
  if (!backendReady() || !supabase) return
  const { error } = await supabase.from('results').insert({
    user_id: userId,
    mode: r.mode,
    level_id: r.levelId ?? null,
    score: r.score,
    throws: r.throws,
    accuracy: Math.min(1, Math.max(0, r.accuracy)),
    stars: r.stars ?? null,
  })
  netWarn('recordResult', error)
}

export async function fetchHistory(userId: string, limit = 30): Promise<ResultRow[]> {
  if (!backendReady() || !supabase) return []
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    netWarn('fetchHistory', error)
    return []
  }
  return (data ?? []) as ResultRow[]
}

export interface PersonalBests {
  campaignStars: number
  levelsCleared: number
  bestTrainingScore: number
  bestDailyScore: number
  totalGames: number
}

/** Личные рекорды считаются из истории — отдельной таблицы для этого не нужно. */
export async function fetchPersonalBests(userId: string): Promise<PersonalBests | null> {
  if (!backendReady() || !supabase) return null

  const [progressRes, resultsRes, dailyRes] = await Promise.all([
    supabase.from('progress').select('stars').eq('user_id', userId),
    supabase.from('results').select('mode, score').eq('user_id', userId),
    supabase.from('daily_results').select('score').eq('user_id', userId),
  ])

  if (progressRes.error || resultsRes.error || dailyRes.error) {
    netWarn('fetchPersonalBests', progressRes.error ?? resultsRes.error ?? dailyRes.error)
    return null
  }

  const progress = (progressRes.data ?? []) as { stars: number }[]
  const results = (resultsRes.data ?? []) as { mode: string; score: number }[]
  const daily = (dailyRes.data ?? []) as { score: number }[]

  return {
    campaignStars: progress.reduce((n, p) => n + p.stars, 0),
    levelsCleared: progress.length,
    bestTrainingScore: Math.max(0, ...results.filter((r) => r.mode === 'training').map((r) => r.score)),
    bestDailyScore: Math.max(0, ...daily.map((d) => d.score)),
    totalGames: results.length,
  }
}
