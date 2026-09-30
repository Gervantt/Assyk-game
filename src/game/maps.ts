import type { DictKey } from '@/i18n'

/**
 * Готовые коны для матча с другом.
 *
 * Раскладка целиком определяет партию: и позиции асыков, и камни, и
 * неровности пола. Всё это уходит в matches.rules, поэтому оба игрока
 * собирают ОДИН И ТОТ ЖЕ мир — иначе разойдутся с первого броска.
 */
export interface OnlineMap {
  id: string
  title: DictKey
  desc: DictKey
  layout: {
    kind: 'row' | 'circle' | 'pyramid' | 'square' | 'custom'
    count: number
    fieldRadius: number
    shape?: 'circle' | 'square'
    positions?: Array<{ x: number; y: number }>
  }
  stones?: Array<{ x: number; y: number; radius: number }>
  relief?: number
  throwsPerPlayer: number
  sakaInFieldPenalty: boolean
}

export const ONLINE_MAPS: OnlineMap[] = [
  {
    id: 'row',
    title: 'map.row',
    desc: 'map.row.d',
    layout: { kind: 'row', count: 5, fieldRadius: 0.93 },
    relief: 0.022,
    throwsPerPlayer: 5,
    sakaInFieldPenalty: true,
  },
  {
    id: 'circle',
    title: 'map.circle',
    desc: 'map.circle.d',
    layout: { kind: 'circle', count: 6, fieldRadius: 1.0 },
    relief: 0.022,
    throwsPerPlayer: 5,
    sakaInFieldPenalty: true,
  },
  {
    id: 'gate',
    title: 'map.gate',
    desc: 'map.gate.d',
    layout: { kind: 'row', count: 4, fieldRadius: 0.85 },
    // два камня оставляют узкий проход: прямой сильный бросок больше не проходит
    stones: [
      { x: -0.52, y: -1.25, radius: 0.2 },
      { x: 0.52, y: -1.25, radius: 0.2 },
    ],
    relief: 0.022,
    throwsPerPlayer: 5,
    sakaInFieldPenalty: true,
  },
  {
    id: 'wall',
    title: 'map.wall',
    desc: 'map.wall.d',
    layout: { kind: 'pyramid', count: 6, fieldRadius: 0.95 },
    // камень прямо по центру: дорогу приходится перекидывать
    stones: [{ x: 0, y: -1.15, radius: 0.22 }],
    relief: 0.03,
    throwsPerPlayer: 6,
    sakaInFieldPenalty: true,
  },
  {
    id: 'rough',
    title: 'map.rough',
    desc: 'map.rough.d',
    layout: { kind: 'circle', count: 7, fieldRadius: 1.12 },
    relief: 0.045,
    throwsPerPlayer: 6,
    sakaInFieldPenalty: false,
  },
]

export function mapById(id: string): OnlineMap | undefined {
  return ONLINE_MAPS.find((m) => m.id === id)
}

export const DEFAULT_MAP = ONLINE_MAPS[0]!
