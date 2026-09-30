import { createWorld, seedFromString, surfaceByName, type CreateWorldOptions } from '@/physics'
import aul from './chapters/01-aul.json'
import aula from './chapters/02-aula.json'
import qala from './chapters/03-qala.json'
import dala from './chapters/04-dala.json'
import { validateChapter } from './validate'
import type { CampaignLevel, ChapterDef, LevelDef } from './types'

const RAW: Array<[unknown, string]> = [
  [aul, '01-aul.json'],
  [aula, '02-aula.json'],
  [qala, '03-qala.json'],
  [dala, '04-dala.json'],
]

export const CHAPTERS: ChapterDef[] = RAW.map(([raw, src]) => validateChapter(raw, src)).sort(
  (a, b) => a.order - b.order,
)

/** Все уровни кампании подряд, с номерами 1..N. */
export const CAMPAIGN: CampaignLevel[] = CHAPTERS.flatMap((chapter) =>
  chapter.levels.map((level, i) => ({
    ...level,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    indexInChapter: i + 1,
    number: 0,
  })),
).map((level, i) => ({ ...level, number: i + 1 }))

export function levelById(id: string): CampaignLevel | undefined {
  return CAMPAIGN.find((l) => l.id === id)
}

export function nextLevel(id: string): CampaignLevel | undefined {
  const i = CAMPAIGN.findIndex((l) => l.id === id)
  return i >= 0 ? CAMPAIGN[i + 1] : undefined
}

/** Сколько асыков всего на поле уровня (включая движущиеся). */
export function totalAsyks(level: LevelDef): number {
  return level.layout.count + (level.movers?.length ?? 0)
}

/** Описание уровня -> параметры мира для физики. */
export function worldOptionsFor(level: LevelDef, seed: number): CreateWorldOptions {
  return {
    seed,
    layout: {
      kind: level.layout.kind,
      count: level.layout.count,
      fieldRadius: level.layout.fieldRadius,
      shape: level.layout.shape,
      spacing: level.layout.spacing,
    },
    obstacles: level.obstacles?.map((o) => ({ x: o.x, y: o.y, radius: o.radius })),
    movers: level.movers,
    wind: level.wind,
    surfaceId: level.surface ? surfaceByName(level.surface) : undefined,
    // Неровности пола — часть замысла уровня. Не задано — берётся значение
    // по умолчанию; 0 делает пол идеально ровным.
    relief: level.relief,
  }
}

/** Мир уровня. Один и тот же seed даёт одинаковую расстановку. */
export function createLevelWorld(level: LevelDef, seed: number) {
  return createWorld(worldOptionsFor(level, seed))
}

/** Правила матча для уровня кампании. */
export function rulesFor(level: LevelDef) {
  return {
    throwsPerPlayer: level.throws,
    goal: level.goal,
    sakaInFieldPenalty: level.penalty !== false,
    extraThrowOnKnockOut: false,
    comboBonus: false,
  }
}

/** Дополнительные параметры мира уровня: камни, ветер, движущиеся асыки. */
export function worldExtrasFor(level: LevelDef) {
  return {
    obstacles: level.obstacles?.map((o) => ({ x: o.x, y: o.y, radius: o.radius })),
    movers: level.movers,
    wind: level.wind,
    surfaceId: level.surface ? surfaceByName(level.surface) : undefined,
    // Неровности пола — часть замысла уровня. Не задано — берётся значение
    // по умолчанию; 0 делает пол идеально ровным.
    relief: level.relief,
  }
}

export type { CampaignLevel, ChapterDef, LevelDef } from './types'

/**
 * Seed уровня. Один на всех и навсегда: от него зависит рельеф пола, а
 * значит и проходимость. Случайный seed делал бы уровень то проходимым,
 * то нет, а пороги звёзд — нечестными.
 *
 * Этим же seed пользуется тест проходимости: иначе он проверял бы не тот
 * кон, который видит игрок.
 */
export function levelSeed(levelId: string): number {
  return seedFromString(`asyq-level-${levelId}`)
}
