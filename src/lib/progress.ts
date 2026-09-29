import { CAMPAIGN } from '@/levels'

const KEY = 'asyq.progress.v1'
const TUTORIAL_KEY = 'asyq.tutorial.v1'

export interface LevelProgress {
  stars: 1 | 2 | 3
  bestThrows: number
}

export type ProgressMap = Record<string, LevelProgress>

export function loadProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ProgressMap) : {}
  } catch {
    return {}
  }
}

/** Сохраняет результат, если он лучше прежнего. true — рекорд обновлён. */
export function saveLevelResult(levelId: string, stars: 1 | 2 | 3, throws: number): boolean {
  const all = loadProgress()
  const prev = all[levelId]
  const better = !prev || stars > prev.stars || (stars === prev.stars && throws < prev.bestThrows)
  if (!better) return false
  all[levelId] = { stars, bestThrows: throws }
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* хранилище недоступно — прогресс не переживёт перезагрузку */
  }
  return true
}

/**
 * Сводит серверный прогресс с локальным по лучшему результату и сохраняет.
 * Нужен при входе в аккаунт: прогресс гостя и прогресс с другого устройства
 * должны сложиться, а не затереть друг друга.
 */
export function mergeProgress(remote: ProgressMap): ProgressMap {
  const local = loadProgress()
  const merged: ProgressMap = { ...local }

  for (const [levelId, r] of Object.entries(remote)) {
    const l = merged[levelId]
    if (!l) {
      merged[levelId] = r
      continue
    }
    merged[levelId] = {
      stars: Math.max(l.stars, r.stars) as 1 | 2 | 3,
      bestThrows: Math.min(l.bestThrows, r.bestThrows),
    }
  }

  try {
    localStorage.setItem(KEY, JSON.stringify(merged))
  } catch {
    /* хранилище недоступно — сведённый прогресс живёт только в этой вкладке */
  }
  return merged
}

/**
 * Уровень открыт, если пройден предыдущий. Первый открыт всегда,
 * чтобы игра начиналась сразу.
 */
export function isUnlocked(levelId: string, progress: ProgressMap): boolean {
  const i = CAMPAIGN.findIndex((l) => l.id === levelId)
  if (i <= 0) return i === 0
  const prev = CAMPAIGN[i - 1]!
  return Boolean(progress[prev.id])
}

/** Первый непройденный уровень — на него ведёт кнопка «Продолжить». */
export function nextUnfinished(progress: ProgressMap) {
  return CAMPAIGN.find((l) => !progress[l.id]) ?? CAMPAIGN[CAMPAIGN.length - 1]!
}

export function totalStars(progress: ProgressMap): number {
  return Object.values(progress).reduce((sum, p) => sum + p.stars, 0)
}

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1'
  } catch {
    return false
  }
}

export function markTutorialDone(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1')
  } catch {
    /* не страшно: обучение просто предложится снова */
  }
}
