/**
 * mulberry32 — быстрый seeded PRNG. Единственный источник случайности в игре.
 * Math.random() в проекте запрещён.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Детерминированный розыгрыш от (seed, cursor) без хранения объекта-генератора.
 * Позволяет восстановить состояние матча из БД одной парой чисел.
 */
export function rngAt(seed: number, cursor: number): number {
  const next = mulberry32((seed + cursor * 0x9e3779b9) >>> 0)
  next()
  return next()
}

/** Целое в [0, n). */
export function rngIntAt(seed: number, cursor: number, n: number): number {
  const v = Math.floor(rngAt(seed, cursor) * n)
  return v >= n ? n - 1 : v
}

/** Seed из строки (для ежедневного испытания из даты). */
export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}
