import { settings } from '@/store/useSettings'

/** Вибрация на телефоне. Молча пропускается там, где её нет или она выключена. */
export function vibrate(pattern: number | number[]): void {
  if (!settings().haptics) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* Safari на iOS не поддерживает — это нормально */
  }
}

export const HAPTIC = {
  knock: 18,
  combo: [24, 40, 24] as number[],
  penalty: [10, 60, 10] as number[],
  win: [30, 50, 30, 50, 60] as number[],
} as const
