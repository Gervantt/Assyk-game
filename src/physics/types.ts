/**
 * Asyq League — детерминированный 2D физический движок.
 *
 * ВАЖНО: этот модуль не импортирует React, three, zustand и типы косметики.
 * Внутри шага симуляции разрешены только + - * / и Math.sqrt.
 */

/** Вид тела. Число, а не строка — чтобы хеш состояния был стабилен и компактен. */
export const BODY_ASYK = 0
export const BODY_SAKA = 1
/** Камень: неподвижное препятствие с бесконечной массой. */
export const BODY_STONE = 2
export type BodyKind = typeof BODY_ASYK | typeof BODY_SAKA | typeof BODY_STONE

export interface Body {
  id: number
  kind: BodyKind
  /** позиция на плоскости земли, метры */
  x: number
  y: number
  /** скорость, м/с */
  vx: number
  vy: number
  radius: number
  mass: number
  /** визуальный угол и угловая скорость — на физику не влияют */
  angle: number
  spin: number
  /** центр тела вышел за границу кона (для асыка = выбит) */
  outOfField: boolean
  /** тело покинуло пределы мира и больше не симулируется */
  removed: boolean
  /** сторона, на которую лёг асық: 0 алшы, 1 тәйкі, 2 бүк, 3 шік (визуал + жеребьёвка) */
  side: number
  /** правила: за этот асық уже начислено очко. Физика это поле НЕ читает. */
  scored: boolean
}

export type FieldShape = 'circle' | 'square'

/** Кон — меловой круг или квадрат. */
export interface Field {
  shape: FieldShape
  cx: number
  cy: number
  /** радиус круга либо половина стороны квадрата */
  radius: number
}

/** Границы мира. bounce=true — упругие стены, false — тело удаляется за границей. */
export interface WorldBounds {
  halfWidth: number
  halfHeight: number
  bounce: boolean
}

/**
 * Колеблющийся асық. Позиция задаётся треугольной волной от номера тика —
 * только целочисленный остаток и арифметика, поэтому детерминизм сохраняется.
 * При первом же столкновении асық «срывается» и дальше живёт обычной физикой.
 */
export interface Mover {
  bodyId: number
  baseX: number
  baseY: number
  /** 0 — вдоль X, 1 — вдоль Y */
  axis: number
  amplitude: number
  /** период колебания в тиках */
  period: number
}

export interface WorldState {
  bodies: Body[]
  field: Field
  bounds: WorldBounds
  /** постоянное ускорение: наклон поля или ветер, м/с^2 */
  windX: number
  windY: number
  /** асыки, которые ходят туда-сюда, пока их не задели */
  movers: Mover[]
  /** линия броска: сақа стартует отсюда */
  throwLineY: number
  /** seed матча и курсор PRNG — вся случайность детерминирована ими */
  seed: number
  rngCursor: number
  tick: number
}

/**
 * Вход броска. Направление и сила уже переведены в скорость и КВАНТОВАНЫ.
 * Именно эти числа уходят по сети — не угол и не сила в пикселях.
 */
export interface ThrowInput {
  vx: number
  vy: number
  /** позиция старта сақа на линии броска (квантована) */
  originX: number
  originY: number
}

export type SimEvent =
  | { type: 'hit'; tick: number; a: number; b: number; impulse: number; x: number; y: number }
  | { type: 'knockOut'; tick: number; bodyId: number; x: number; y: number }
  | { type: 'wallBounce'; tick: number; bodyId: number; impulse: number }
  | { type: 'sakaStoppedInside'; tick: number; x: number; y: number }
  | { type: 'sakaLost'; tick: number }

/** Кадр для анимации. z — чисто визуальная высота (физика 2D). */
export interface FrameBody {
  id: number
  x: number
  y: number
  z: number
  angle: number
  removed: boolean
}

export interface Frame {
  tick: number
  bodies: FrameBody[]
}

export interface SimResult {
  finalState: WorldState
  frames: Frame[]
  events: SimEvent[]
  /** сколько тиков длилась симуляция */
  ticks: number
}
