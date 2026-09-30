// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: src/physics/world.ts
import { PHYSICS, STATE_RESTING } from './config.ts'
import { quantize } from './math.ts'
import { heightAt, reliefFor } from './relief.ts'
import { rngIntAt } from './rng.ts'
import { SURFACE_SAND, surfaceAt } from './surfaces.ts'
import {
  BODY_ASYK,
  BODY_SAKA,
  BODY_STONE,
  type Body,
  type Field,
  type Mover,
  type WorldState,
} from './types.ts'

export type LayoutKind = 'row' | 'pyramid' | 'circle' | 'square' | 'custom'

export interface LayoutSpec {
  kind: LayoutKind
  count: number
  /** радиус кона, м */
  fieldRadius?: number
  shape?: Field['shape']
  spacing?: number
  /**
   * Явные позиции асыков — раскладка из редактора испытаний. Учитываются
   * только при kind === 'custom'; count при этом игнорируется.
   */
  positions?: Array<{ x: number; y: number }>
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

  if (spec.kind === 'custom') {
    for (const p of spec.positions ?? []) out.push({ x: p.x, y: p.y })
  } else if (spec.kind === 'row') {
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

/** Неподвижное препятствие на поле. */
export interface ObstacleSpec {
  x: number
  y: number
  radius: number
}

/** Асық, который ходит туда-сюда, пока его не задели. */
export interface MoverSpec {
  x: number
  y: number
  /** 'x' — поперёк поля, 'y' — от игрока и обратно */
  axis: 'x' | 'y'
  amplitude: number
  /** период колебания в секундах */
  periodSec: number
}

export interface CreateWorldOptions {
  seed: number
  layout: LayoutSpec
  throwLineY?: number
  boundsHalfWidth?: number
  boundsHalfHeight?: number
  bounceWalls?: boolean
  obstacles?: ObstacleSpec[]
  movers?: MoverSpec[]
  /** наклон поля: постоянное ускорение, м/с^2 */
  wind?: { x: number; y: number }
  /** поверхность кона: задаётся уровнем или режимом, но НЕ скином арены */
  surfaceId?: number
  /**
   * Амплитуда неровностей пола, м. По умолчанию PHYSICS.reliefAmplitude.
   * Ноль — идеально ровно (обучение, где рельеф только мешал бы учиться).
   */
  relief?: number
}

/** Собирает стартовый мир: сақа на линии броска (id 0) + асыки в кону. */
export function createWorld(opts: CreateWorldOptions): WorldState {
  const halfW0 = opts.boundsHalfWidth ?? 4.6
  const halfH0 = opts.boundsHalfHeight ?? 4.6
  const amp = opts.relief ?? PHYSICS.reliefAmplitude
  // тела надо ставить НА рельеф, иначе на бугре они наполовину в земле
  const ground = reliefFor(opts.seed, amp, halfW0 > halfH0 ? halfW0 : halfH0)
  const floorAt = (x: number, y: number) => quantize(heightAt(ground, x, y))

  const fieldRadius = opts.layout.fieldRadius ?? 0.85
  const field: Field = { shape: opts.layout.shape ?? 'circle', cx: 0, cy: 0, radius: fieldRadius }
  const throwLineY = opts.throwLineY ?? DEFAULT_THROW_LINE_Y

  const saka: Body = {
    id: 0,
    kind: BODY_SAKA,
    x: 0,
    y: throwLineY,
    z: quantize(floorAt(0, throwLineY) + PHYSICS.sakaRadius),
    vx: 0,
    vy: 0,
    vz: 0,
    radius: PHYSICS.sakaRadius,
    mass: PHYSICS.sakaMass,
    height: PHYSICS.sakaHeight,
    tumble: 0,
    omega: 0,
    yaw: 0,
    state: STATE_RESTING,
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
      z: quantize(floorAt(p.x, p.y) + PHYSICS.asykRadius),
      vx: 0,
      vy: 0,
      vz: 0,
      radius: PHYSICS.asykRadius,
      mass: PHYSICS.asykMass,
      height: PHYSICS.asykHeight,
      tumble: 0,
      omega: 0,
      yaw: 0,
      state: STATE_RESTING,
      outOfField: false,
      removed: false,
      side: rngIntAt(opts.seed, 1000 + i, 4),
      scored: false,
    })
  })

  // колеблющиеся асыки — обычные асыки плюс запись в movers
  const movers: Mover[] = []
  for (const m of opts.movers ?? []) {
    const id = bodies.length
    bodies.push({
      id,
      kind: BODY_ASYK,
      x: quantize(m.x),
      y: quantize(m.y),
      z: PHYSICS.asykRadius,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: PHYSICS.asykRadius,
      mass: PHYSICS.asykMass,
      height: PHYSICS.asykHeight,
      tumble: 0,
      omega: 0,
      yaw: 0,
      state: STATE_RESTING,
      outOfField: false,
      removed: false,
      side: rngIntAt(opts.seed, 2000 + id, 4),
      scored: false,
    })
    movers.push({
      bodyId: id,
      baseX: quantize(m.x),
      baseY: quantize(m.y),
      axis: m.axis === 'x' ? 0 : 1,
      amplitude: quantize(m.amplitude),
      period: Math.max(2, Math.round(m.periodSec / PHYSICS.dt)),
    })
  }

  // камни-препятствия
  for (const o of opts.obstacles ?? []) {
    bodies.push({
      id: bodies.length,
      kind: BODY_STONE,
      x: quantize(o.x),
      y: quantize(o.y),
      z: quantize(floorAt(o.x, o.y) + o.radius),
      vx: 0,
      vy: 0,
      vz: 0,
      radius: quantize(o.radius),
      mass: PHYSICS.asykMass,
      height: quantize(o.radius),
      tumble: 0,
      omega: 0,
      yaw: 0,
      state: STATE_RESTING,
      outOfField: true,
      removed: false,
      side: 0,
      scored: false,
    })
  }

  // ветер сильнее трения превратил бы симуляцию в вечный разгон
  const windCap = surfaceAt(opts.surfaceId ?? SURFACE_SAND).muSlide * PHYSICS.g * 0.8
  const wx = clampAbs(opts.wind?.x ?? 0, windCap)
  const wy = clampAbs(opts.wind?.y ?? 0, windCap)

  return {
    bodies,
    field,
    bounds: { halfWidth: halfW0, halfHeight: halfH0, bounce: opts.bounceWalls ?? false },
    surfaceId: opts.surfaceId ?? SURFACE_SAND,
    windX: quantize(wx),
    windY: quantize(wy),
    movers,
    throwLineY,
    // Рельеф выводится из seed матча, поэтому одинаков у обоих соперников
    // и при каждой перезагрузке: это часть уровня, а не случайность.
    reliefAmp: amp,
    seed: opts.seed,
    rngCursor: 0,
    tick: 0,
  }
}

function clampAbs(v: number, limit: number): number {
  return v > limit ? limit : v < -limit ? -limit : v
}

export function cloneWorld(s: WorldState): WorldState {
  return {
    bodies: s.bodies.map((b) => ({ ...b })),
    field: { ...s.field },
    bounds: { ...s.bounds },
    surfaceId: s.surfaceId,
    windX: s.windX,
    windY: s.windY,
    movers: s.movers.map((m) => ({ ...m })),
    throwLineY: s.throwLineY,
    reliefAmp: s.reliefAmp,
    seed: s.seed,
    rngCursor: s.rngCursor,
    tick: s.tick,
  }
}

/** Асыки, которые ещё в кону (не выбиты и не удалены). */
export function asyksInField(s: WorldState): Body[] {
  return s.bodies.filter((b) => b.kind === BODY_ASYK && !b.outOfField && !b.removed)
}
