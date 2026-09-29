import { PHYSICS } from './config'
import { quantize } from './math'
import { rngIntAt } from './rng'
import { BODY_ASYK, BODY_SAKA, type Body, type Field, type WorldState } from './types'

export type LayoutKind = 'row' | 'pyramid' | 'circle' | 'square'

export interface LayoutSpec {
  kind: LayoutKind
  count: number
  /** радиус кона, м */
  fieldRadius?: number
  shape?: Field['shape']
  spacing?: number
}

export const DEFAULT_THROW_LINE_Y = -3.1

/**
 * Позиции асыков для раскладки. Здесь Math.cos/sin допустимы: это построение
 * уровня, а не шаг симуляции, и все координаты сразу квантуются до 1e-4,
 * поэтому расхождения последних битов между браузерами исчезают.
 */
export function layoutPositions(spec: LayoutSpec): Array<{ x: number; y: number }> {
  const n = spec.count
  const gap = spec.spacing ?? PHYSICS.asykRadius * 3.4
  const out: Array<{ x: number; y: number }> = []

  if (spec.kind === 'row') {
    const start = -((n - 1) * gap) / 2
    for (let i = 0; i < n; i++) out.push({ x: start + i * gap, y: 0 })
  } else if (spec.kind === 'circle') {
    const r = spec.fieldRadius ? spec.fieldRadius * 0.55 : 0.6
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n
      out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r })
    }
  } else if (spec.kind === 'square') {
    const cols = Math.ceil(Math.sqrt(n))
    const start = -((cols - 1) * gap) / 2
    for (let i = 0; i < n; i++) {
      out.push({ x: start + (i % cols) * gap, y: start + Math.floor(i / cols) * gap })
    }
  } else {
    // pyramid: 1, 2, 3, ... рядами, вершиной к игроку
    let row = 0
    let placed = 0
    while (placed < n) {
      const inRow = Math.min(row + 1, n - placed)
      const start = -((inRow - 1) * gap) / 2
      for (let i = 0; i < inRow; i++) out.push({ x: start + i * gap, y: row * gap * 0.88 })
      placed += inRow
      row++
    }
  }

  return out.map((p) => ({ x: quantize(p.x), y: quantize(p.y) }))
}

export interface CreateWorldOptions {
  seed: number
  layout: LayoutSpec
  throwLineY?: number
  boundsHalfWidth?: number
  boundsHalfHeight?: number
  bounceWalls?: boolean
}

/** Собирает стартовый мир: сақа на линии броска (id 0) + асыки в кону. */
export function createWorld(opts: CreateWorldOptions): WorldState {
  const fieldRadius = opts.layout.fieldRadius ?? 1.15
  const field: Field = { shape: opts.layout.shape ?? 'circle', cx: 0, cy: 0, radius: fieldRadius }
  const throwLineY = opts.throwLineY ?? DEFAULT_THROW_LINE_Y

  const saka: Body = {
    id: 0,
    kind: BODY_SAKA,
    x: 0,
    y: throwLineY,
    vx: 0,
    vy: 0,
    radius: PHYSICS.sakaRadius,
    mass: PHYSICS.sakaMass,
    angle: 0,
    spin: 0,
    outOfField: true,
    removed: false,
    side: 0,
    scored: false,
  }

  const bodies: Body[] = [saka]
  const positions = layoutPositions({ ...opts.layout, fieldRadius })
  positions.forEach((p, i) => {
    bodies.push({
      id: i + 1,
      kind: BODY_ASYK,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      radius: PHYSICS.asykRadius,
      mass: PHYSICS.asykMass,
      angle: 0,
      spin: 0,
      outOfField: false,
      removed: false,
      side: rngIntAt(opts.seed, 1000 + i, 4),
      scored: false,
    })
  })

  return {
    bodies,
    field,
    bounds: {
      halfWidth: opts.boundsHalfWidth ?? 4.6,
      halfHeight: opts.boundsHalfHeight ?? 4.6,
      bounce: opts.bounceWalls ?? false,
    },
    throwLineY,
    seed: opts.seed,
    rngCursor: 0,
    tick: 0,
  }
}

export function cloneWorld(s: WorldState): WorldState {
  return {
    bodies: s.bodies.map((b) => ({ ...b })),
    field: { ...s.field },
    bounds: { ...s.bounds },
    throwLineY: s.throwLineY,
    seed: s.seed,
    rngCursor: s.rngCursor,
    tick: s.tick,
  }
}

/** Асыки, которые ещё в кону (не выбиты и не удалены). */
export function asyksInField(s: WorldState): Body[] {
  return s.bodies.filter((b) => b.kind === BODY_ASYK && !b.outOfField && !b.removed)
}
