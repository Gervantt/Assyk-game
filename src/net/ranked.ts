import { backendReady, netWarn, supabase } from './supabase'

export interface RatingChange {
  delta: number
  rating: number
  opponentDelta: number
}

/**
 * Встать в очередь. Возвращает id матча, если соперник нашёлся сразу,
 * и null, если мы теперь ждём. Подбор делает сервер одним вызовом:
 * иначе двое могли бы одновременно «никого не найти» и сесть ждать друг друга.
 */
export async function enqueueRanked(): Promise<string | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.rpc('enqueue_ranked')
  if (error) {
    netWarn('enqueueRanked', error)
    return null
  }
  return (data as string | null) ?? null
}

export async function dequeueRanked(): Promise<void> {
  if (!backendReady() || !supabase) return
  const { error } = await supabase.rpc('dequeue_ranked')
  if (error) netWarn('dequeueRanked', error)
}

/** Соперник мог создать матч сам — на очередь Realtime-события нет. */
export async function pollRanked(): Promise<string | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.rpc('poll_ranked')
  if (error) {
    netWarn('pollRanked', error)
    return null
  }
  return (data as string | null) ?? null
}

/**
 * Просит сервер пересчитать матч и начислить рейтинг. Клиент НЕ сообщает
 * результат: Edge Function переигрывает все ходы сама и верит только себе.
 * Вызывать может любой из двоих — функция идемпотентна.
 */
export async function requestRating(matchId: string, myId: string): Promise<RatingChange | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.functions.invoke('rate-match', {
    body: { matchId },
  })
  if (error) {
    netWarn('requestRating', error)
    return null
  }
  const r = data as {
    already?: boolean
    player1?: string
    delta1?: number
    rating1?: number
    delta2?: number
    rating2?: number
  }
  if (r?.already || r?.player1 === undefined) return null
  const mine = r.player1 === myId
  return {
    delta: (mine ? r.delta1 : r.delta2) ?? 0,
    rating: (mine ? r.rating1 : r.rating2) ?? 0,
    opponentDelta: (mine ? r.delta2 : r.delta1) ?? 0,
  }
}
