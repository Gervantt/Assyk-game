import { PHYSICS } from '@/physics'
import type { ChapterDef, LevelDef } from './types'

/**
 * Проверка описаний уровней при загрузке. Уровни лежат в JSON, значит
 * опечатку компилятор не поймает — ловим её здесь и сразу с понятным текстом.
 */
export function validateChapter(raw: unknown, source: string): ChapterDef {
  const c = raw as ChapterDef
  const fail = (msg: string): never => {
    throw new Error(`${source}: ${msg}`)
  }

  if (!c || typeof c.id !== 'string' || !c.id) fail('нет поля id')
  if (typeof c.order !== 'number') fail('нет поля order')
  for (const key of ['title', 'subtitle'] as const) {
    const t = c[key]
    if (!t || !t.kk || !t.ru || !t.en) fail(`${key} должен содержать kk, ru и en`)
  }
  if (!Array.isArray(c.levels) || c.levels.length === 0) fail('нет уровней')

  const ids = new Set<string>()
  for (const level of c.levels) validateLevel(level, `${source}/${level?.id ?? '?'}`, ids)
  return c
}

function validateLevel(l: LevelDef, source: string, ids: Set<string>): void {
  const fail = (msg: string): never => {
    throw new Error(`${source}: ${msg}`)
  }

  if (typeof l.id !== 'string' || !l.id) fail('нет поля id')
  if (ids.has(l.id)) fail('повторяющийся id уровня')
  ids.add(l.id)

  if (!l.layout || typeof l.layout.count !== 'number') fail('нет layout.count')
  const extra = (l.movers?.length ?? 0) + l.layout.count
  if (extra < 1) fail('на поле нет ни одного асыка')

  if (!Number.isInteger(l.throws) || l.throws < 1) fail('throws должен быть целым числом ≥ 1')
  if (!Number.isInteger(l.goal) || l.goal < 1) fail('goal должен быть целым числом ≥ 1')
  if (l.goal > extra) fail(`goal=${l.goal} больше, чем асыков на поле (${extra})`)

  if (!Array.isArray(l.stars) || l.stars.length !== 2) fail('stars должен быть парой чисел')
  const [s3, s2] = l.stars
  if (!(s3 >= 1 && s2 >= s3 && s2 <= l.throws)) {
    fail(`stars=[${s3}, ${s2}] должны расти и укладываться в throws=${l.throws}`)
  }

  if (l.maxPower !== undefined && !(l.maxPower > 0 && l.maxPower <= 1)) {
    fail('maxPower должен быть в диапазоне (0, 1]')
  }

  const windCap = PHYSICS.friction * 0.8
  if (l.wind) {
    if (Math.abs(l.wind.x) > windCap || Math.abs(l.wind.y) > windCap) {
      fail(`ветер сильнее ${windCap.toFixed(2)} м/с² будет обрезан движком`)
    }
  }

  for (const o of l.obstacles ?? []) {
    if (!(o.radius > 0)) fail('радиус препятствия должен быть больше нуля')
  }
  for (const m of l.movers ?? []) {
    if (m.axis !== 'x' && m.axis !== 'y') fail("axis должен быть 'x' или 'y'")
    if (!(m.amplitude > 0)) fail('амплитуда должна быть больше нуля')
    if (!(m.periodSec > 0.2)) fail('период колебания слишком мал')
  }
}
