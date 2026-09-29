import { create } from 'zustand'
import {
  isUnlocked,
  loadProgress,
  nextUnfinished,
  saveLevelResult,
  totalStars,
  type ProgressMap,
} from '@/lib/progress'
import { CAMPAIGN } from '@/levels'

interface ProgressStore {
  progress: ProgressMap
  /** перечитать из localStorage — после синхронизации с облаком */
  reload: () => void
  /** записать результат уровня; true, если рекорд обновлён */
  record: (levelId: string, stars: 1 | 2 | 3, throws: number) => boolean
}

/**
 * Прогресс кампании как реактивное состояние.
 *
 * Раньше экраны читали localStorage прямо при отрисовке, и прогресс,
 * приехавший из облака уже после монтирования, оставался невидимым:
 * счётчик звёзд показывал ноль, а уровни не разблокировались.
 */
export const useProgressStore = create<ProgressStore>((set) => ({
  progress: loadProgress(),

  reload: () => set({ progress: loadProgress() }),

  record: (levelId, stars, throws) => {
    const improved = saveLevelResult(levelId, stars, throws)
    set({ progress: loadProgress() })
    return improved
  },
}))

/** Звёзд всего и сколько их максимум. */
export function useStars(): { earned: number; max: number } {
  const progress = useProgressStore((s) => s.progress)
  return { earned: totalStars(progress), max: CAMPAIGN.length * 3 }
}

export function useIsUnlocked(levelId: string): boolean {
  const progress = useProgressStore((s) => s.progress)
  return isUnlocked(levelId, progress)
}

export function useNextUnfinished() {
  const progress = useProgressStore((s) => s.progress)
  return nextUnfinished(progress)
}
