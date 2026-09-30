// Asyq League — пересчёт рейтинга после рейтингового матча.
//
// Защита от подмены результата (SPEC): функция НЕ верит тому, что прислал
// клиент. Она берёт из БД seed, правила и все ходы, переигрывает партию тем
// же кодом, что и клиент (supabase/functions/_shared — механическая копия
// src/physics и src/game/rules, её расхождение ловит тест), и начисляет ELO
// по собственному результату. Подделанный state или winner ни на что не влияют.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { replayMatch, type OnlineRules } from '../_shared/rules/index.ts'
import type { ThrowInput } from '../_shared/physics/index.ts'

interface MoveRow {
  turn_no: number
  input: ThrowInput
  result_hash: string
}

interface MatchRow {
  id: string
  mode: string
  seed: number
  rules: OnlineRules
  status: string
  player1: string
  player2: string | null
  rated_at: string | null
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply({ error: 'нужен POST' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return reply({ error: 'функция не настроена' }, 500)

  // Кто зовёт: рейтинг может пересчитать только участник матча.
  const auth = req.headers.get('Authorization') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: auth } } })
  const { data: userData } = await asUser.auth.getUser()
  const caller = userData?.user?.id
  if (!caller) return reply({ error: 'нужен вход' }, 401)

  let matchId: string
  try {
    matchId = (await req.json()).matchId
  } catch {
    return reply({ error: 'ожидается { matchId }' }, 400)
  }
  if (!matchId) return reply({ error: 'ожидается { matchId }' }, 400)

  const admin = createClient(url, serviceKey)
  const { data, error } = await admin.rpc('match_for_rating', { p_match_id: matchId })
  if (error) return reply({ error: error.message }, 500)
  if (!data?.match) return reply({ error: 'матч не найден' }, 404)

  const match = data.match as MatchRow
  const moves = (data.moves ?? []) as MoveRow[]

  if (match.mode !== 'ranked') return reply({ error: 'матч не рейтинговый' }, 400)
  if (caller !== match.player1 && caller !== match.player2)
    return reply({ error: 'не участник матча' }, 403)
  if (match.rated_at) return reply({ rated: true, already: true })
  if (!match.player2) return reply({ error: 'во втором слоте никого нет' }, 400)

  // ── Пересчёт ──────────────────────────────────────────────────────────────
  const ordered = [...moves].sort((a, b) => a.turn_no - b.turn_no)
  const { match: finished, mismatchAt } = replayMatch(
    Number(match.seed),
    match.rules,
    ordered.map((m) => ({ input: m.input, result_hash: m.result_hash })),
  )

  if (finished.status !== 'finished') {
    return reply({ error: 'матч ещё не доигран', turns: ordered.length }, 409)
  }

  // Индекс 0 — player1, индекс 1 — player2: так же собирает матч клиент.
  const winnerId =
    finished.winner === null ? null : finished.winner === 0 ? match.player1 : match.player2

  const { data: applied, error: rateError } = await admin.rpc('apply_ranked_result', {
    p_match_id: matchId,
    p_winner: winnerId,
  })
  if (rateError) return reply({ error: rateError.message }, 500)

  return reply({
    rated: true,
    // расхождение не отменяет начисления: считаем по своему пересчёту,
    // но сообщаем о нём — это сигнал о баге или попытке подмены
    mismatchAt,
    scores: finished.players.map((p) => p.score),
    winner: winnerId,
    ...applied,
  })
})
