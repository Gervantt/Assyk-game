import { beforeEach, describe, expect, it } from 'vitest'
import { loadBest, saveBest } from '../storage'

// Тесты идут в окружении node: физике браузерное API не нужно, и переводить
// весь прогон на jsdom ради одного модуля дорого. Хватает заглушки.
const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
} as Storage

beforeEach(() => {
  store.clear()
})

describe('личные рекорды', () => {
  const rec = (score: number, accuracy = 0.5) => ({
    score,
    accuracy,
    bestThrow: score,
    bestStreak: score,
  })

  it('нулевой результат сохраняется, но рекордом не объявляется', () => {
    // иначе новичок, не выбивший ни одного асыка, получает «Новый рекорд!»
    expect(saveBest('training', rec(0))).toBe(false)
    expect(loadBest('training')?.score).toBe(0)
  })

  it('первый результат со счётом — рекорд', () => {
    expect(saveBest('training', rec(2))).toBe(true)
  })

  it('результат хуже прежнего рекордом не считается', () => {
    saveBest('training', rec(3))
    expect(saveBest('training', rec(1))).toBe(false)
    expect(loadBest('training')?.score).toBe(3)
  })

  it('при равном счёте решает точность', () => {
    saveBest('training', rec(3, 0.4))
    expect(saveBest('training', rec(3, 0.7))).toBe(true)
    expect(loadBest('training')?.accuracy).toBeCloseTo(0.7)
  })
})
