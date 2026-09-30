import type { MatchMode } from '@/game/rules'

const KEY = 'asyq.best.v1'

export interface BestRecord {
  score: number
  accuracy: number
  bestThrow: number
  bestStreak: number
  at: string
}

type BestMap = Partial<Record<MatchMode, BestRecord>>

function read(): BestMap {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as BestMap) : {}
  } catch {
    return {}
  }
}

export function loadBest(mode: MatchMode): BestRecord | null {
  return read()[mode] ?? null
}

/** Сохраняет рекорд, если он лучше прежнего. Возвращает true, если рекорд побит. */
export function saveBest(mode: MatchMode, rec: Omit<BestRecord, 'at'>): boolean {
  const all = read()
  const prev = all[mode]
  const better =
    !prev ||
    rec.score > prev.score ||
    (rec.score === prev.score && rec.accuracy > prev.accuracy)
  if (!better) return false
  all[mode] = { ...rec, at: new Date().toISOString() }
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* хранилище недоступно — рекорд просто не переживёт перезагрузку */
  }
  // Первый же сыгранный раунд формально «лучший», но хвалить за 0 выбитых
  // асыков нельзя: новичок решит, что так и надо. Рекорд сохраняем,
  // надпись не показываем.
  return rec.score > 0
}
