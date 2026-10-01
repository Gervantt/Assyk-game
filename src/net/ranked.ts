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

interface RatingReply {
  already?: boolean
  player1?: string
  delta1?: number
  rating1?: number
  delta2?: number
  rating2?: number
}

function pick(r: RatingReply | null, myId: string): RatingChange | null {
  if (!r || r.player1 === undefined) return null
  const mine = r.player1 === myId
  return {
    delta: (mine ? r.delta1 : r.delta2) ?? 0,
    rating: (mine ? r.rating1 : r.rating2) ?? 0,
    opponentDelta: (mine ? r.delta2 : r.delta1) ?? 0,
  }
}

/**
 * Начисление рейтинга и результат для ЭТОГО игрока.
 *
 * 1. Edge Function rate-match переигрывает матч и начисляет ELO. Это
 *    основной путь: клиент не сообщает результат, функция верит только себе.
 * 2. Если матч уже посчитан (вторым запросом) — просто читаем начисленное.
 *    Раньше второй игрок получал пустой ответ и вечно видел «Считаем…».
 * 3. Если функция не развёрнута или недоступна — запасной путь в базе
 *    (claim_ranked_result), пока он не выключен флагом ranked_fallback.
 */
export async function requestRating(matchId: string, myId: string): Promise<RatingChange | null> {
  if (!backendReady() || !supabase) return null

  const viaFunction = await supabase.functions.invoke('rate-match', { body: { matchId } })
  if (!viaFunction.error) {
    const r = viaFunction.data as RatingReply & { rated?: boolean }
    if (r?.player1 !== undefined) return pick(r, myId)
    if (r?.already) return readResult(matchId, myId)
  } else {
    netWarn('requestRating: rate-match недоступна, запасной путь', viaFunction.error)
  }

  const fallback = await supabase.rpc('claim_ranked_result', { p_match_id: matchId })
  if (fallback.error) {
    netWarn('claim_ranked_result', fallback.error)
    return readResult(matchId, myId)
  }
  return pick(fallback.data as RatingReply, myId)
}

async function readResult(matchId: string, myId: string): Promise<RatingChange | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('ranked_result', { p_match_id: matchId })
  if (error) {
    netWarn('ranked_result', error)
    return null
  }
  return pick(data as RatingReply | null, myId)
}
