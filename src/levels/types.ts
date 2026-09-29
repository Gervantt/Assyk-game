import type { FieldShape, LayoutKind, SurfaceName } from '@/physics'
import type { Locale } from '@/i18n'

export type LocalisedText = Record<Locale, string>

export interface LevelLayout {
  kind: LayoutKind
  count: number
  fieldRadius?: number
  shape?: FieldShape
  spacing?: number
}

export interface LevelObstacle {
  x: number
  y: number
  radius: number
}

export interface LevelMover {
  x: number
  y: number
  axis: 'x' | 'y'
  amplitude: number
  periodSec: number
}

export interface LevelDef {
  id: string
  layout: LevelLayout
  /** бюджет бросков */
  throws: number
  /** сколько асыков надо выбить */
  goal: number
  /** пороги бросков: [на 3 звезды, на 2 звезды] */
  stars: [number, number]
  /** штраф за сақа в кону; по умолчанию включён */
  penalty?: boolean
  /** ограничение силы, 0..1 */
  maxPower?: number
  wind?: { x: number; y: number }
  obstacles?: LevelObstacle[]
  movers?: LevelMover[]
  /** поверхность кона: только оформление уровня, к скинам отношения не имеет */
  surface?: SurfaceName
}

export interface ChapterDef {
  id: string
  order: number
  title: LocalisedText
  subtitle: LocalisedText
  levels: LevelDef[]
}

/** Уровень вместе с местом в кампании. */
export interface CampaignLevel extends LevelDef {
  chapterId: string
  chapterTitle: LocalisedText
  /** сквозной номер 1..24 */
  number: number
  /** номер внутри главы, с 1 */
  indexInChapter: number
}
