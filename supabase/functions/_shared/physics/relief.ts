// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: src/physics/relief.ts
import { quantize } from './math.ts'
import { mulberry32 } from './rng.ts'

/**
 * Рельеф земли — сетка высот.
 *
 * Зачем: на идеально плоском полу сильный плоский бросок выбивал асыки при
 * любом угле, и другой тактики не существовало. Неровности уводят скользящую
 * сақа в сторону, и попадание перестаёт быть гарантированным — при этом
 * исход остаётся полностью предсказуемым для игрока: рельеф один и тот же
 * у обоих соперников и не меняется между попытками.
 *
 * Детерминизм: сетка строится один раз при создании мира из seed матча
 * (там арифметика не ограничена), высоты сразу квантуются до 1e-4. Внутри
 * шага симуляции читается только билинейной интерполяцией — + - * / и всё.
 */
export interface Relief {
  /** число узлов по стороне */
  size: number
  /** размер ячейки, м */
  cell: number
  /** координата узла [0][0], м */
  origin: number
  /** высоты, size * size, ряд за рядом */
  h: Float64Array
}

/**
 * Сетка не хранится в состоянии мира, а выводится из него.
 *
 * Причина практическая: matches.state уходит в Postgres как jsonb, а
 * Float64Array после JSON превращается в обычный объект — билинейная
 * интерполяция по нему уже не та. Поэтому в состоянии лежит одно число
 * (амплитуда), а сетка строится по нему и по seed и кэшируется.
 */
const cache = new Map<string, Relief>()

export function reliefFor(seed: number, amplitude: number, extent: number): Relief {
  if (!(amplitude > 0)) return FLAT
  const key = `${seed}:${amplitude}:${extent}`
  const hit = cache.get(key)
  if (hit) return hit
  const made = makeRelief(seed, amplitude, extent)
  // кэш ограничен: матчей за сессию много, а сетки держать все незачем
  if (cache.size > 24) cache.clear()
  cache.set(key, made)
  return made
}

/** Плоский пол: рельефа нет. Используется в обучении и там, где он мешает. */
export const FLAT: Relief = { size: 2, cell: 1, origin: -0.5, h: new Float64Array(4) }

export function isFlat(r: Relief): boolean {
  for (let i = 0; i < r.h.length; i++) if (r.h[i] !== 0) return false
  return true
}

/**
 * Строит рельеф: случайные значения в узлах, затем сглаживание.
 * Сглаживание важно — без него соседние узлы дают отвесные стенки, и тело
 * получает удар в бок вместо плавного увода.
 *
 * @param amplitude максимальное отклонение высоты, м
 * @param extent    полуразмер покрываемой площади, м
 * @param size      узлов по стороне; крупнее сетка — длиннее волны рельефа.
 *                  Ячейка не должна быть мельче диаметра тела: шар радиуса R
 *                  перекрывает бугры короче 2R и физически их не чувствует.
 *                  При extent 4.6 и size 65 ячейка 0.144 м — как раз диаметр сақа.
 */
export function makeRelief(seed: number, amplitude: number, extent: number, size = 65): Relief {
  const cell = (extent * 2) / (size - 1)
  const rnd = mulberry32(seed ^ 0x9e3779b9)
  let h = new Float64Array(size * size)
  for (let i = 0; i < h.length; i++) h[i] = rnd() * 2 - 1

  // две сглаживающие свёртки 3x3: получаются пологие бугры, а не иглы
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float64Array(size * size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum = 0
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const sx = x + dx
            const sy = y + dy
            if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue
            sum += h[sy * size + sx]!
            n++
          }
        }
        next[y * size + x] = sum / n
      }
    }
    h = next
  }

  // нормируем к заданной амплитуде: после сглаживания размах всегда меньше 1
  let peak = 0
  for (let i = 0; i < h.length; i++) {
    const a = h[i]! < 0 ? -h[i]! : h[i]!
    if (a > peak) peak = a
  }
  const k = peak > 0 ? amplitude / peak : 0
  for (let i = 0; i < h.length; i++) h[i] = quantize(h[i]! * k)

  return { size, cell, origin: -extent, h }
}

/** Индекс ячейки и доля внутри неё. Выход за сетку прижимается к краю. */
function cellOf(r: Relief, v: number): { i: number; f: number } {
  const t = (v - r.origin) / r.cell
  let i = Math.floor(t)
  if (i < 0) i = 0
  if (i > r.size - 2) i = r.size - 2
  const f = t - i
  return { i, f: f < 0 ? 0 : f > 1 ? 1 : f }
}

/** Высота земли в точке. Билинейно — только арифметика. */
export function heightAt(r: Relief, x: number, y: number): number {
  const cx = cellOf(r, x)
  const cy = cellOf(r, y)
  const i = cx.i
  const j = cy.i
  const h00 = r.h[j * r.size + i]!
  const h10 = r.h[j * r.size + i + 1]!
  const h01 = r.h[(j + 1) * r.size + i]!
  const h11 = r.h[(j + 1) * r.size + i + 1]!
  const top = h00 + (h10 - h00) * cx.f
  const bottom = h01 + (h11 - h01) * cx.f
  return top + (bottom - top) * cy.f
}

/**
 * Уклон в точке: насколько высота растёт по x и по y.
 * Считается разностью высот на шаг ячейки — тоже одна арифметика.
 */
export function slopeAt(r: Relief, x: number, y: number): { dx: number; dy: number } {
  const s = r.cell * 0.5
  return {
    dx: (heightAt(r, x + s, y) - heightAt(r, x - s, y)) / (s * 2),
    dy: (heightAt(r, x, y + s) - heightAt(r, x, y - s)) / (s * 2),
  }
}
