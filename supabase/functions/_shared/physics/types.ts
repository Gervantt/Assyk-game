// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: src/physics/types.ts
/**
 * Asyq League — детерминированный физический движок 2.5D.
 *
 * Игра логически трёхмерна: сақа летит по дуге, бьётся о землю, отскакивает,
 * скользит и останавливается. Коллайдер — сфера, меш рисуется поверх неё.
 *
 * ВАЖНО: этот модуль не импортирует React, three, zustand, скины и арены.
 * Внутри шага симуляции разрешены только + - * / и Math.sqrt.
 */

/** Вид тела. Число, а не строка — чтобы хеш состояния был стабилен и компактен. */
export const BODY_ASYK = 0
export const BODY_SAKA = 1
/** Камень: неподвижное препятствие с бесконечной массой. */
export const BODY_STONE = 2
export type BodyKind = typeof BODY_ASYK | typeof BODY_SAKA | typeof BODY_STONE

/** Фаза жизни тела: в воздухе, скользит по земле, лежит. */
export type BodyState = 0 | 1 | 2

export interface Body {
  id: number
  kind: BodyKind
  /** центр коллайдера, метры. z отсчитывается от земли, в покое z = radius */
  x: number
  y: number
  z: number
  /** скорость, м/с */
  vx: number
  vy: number
  vz: number
  radius: number
  mass: number
  /** высота меша над землёй в покое — только для рисования */
  height: number
  /** кувыркание вокруг горизонтальной оси: угол и угловая скорость */
  tumble: number
  omega: number
  /** рыскание вокруг вертикали — чистый визуал */
  yaw: number
  state: BodyState
  /** тело остановилось за границей кона (для асыка = выбит) */
  outOfField: boolean
  /** тело покинуло пределы мира и больше не симулируется */
  removed: boolean
  /** сторона, на которую лёг асық: 0 алшы, 1 тәйкі, 2 бүк, 3 шік */
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
  /** индекс поверхности из SURFACES: задаётся уровнем, не скином */
  surfaceId: number
  /** постоянное ускорение: наклон поля или ветер, м/с^2 */
  windX: number
  windY: number
  /** асыки, которые ходят туда-сюда, пока их не задели */
  movers: Mover[]
  /** линия броска: сақа стартует отсюда */
  throwLineY: number
  /**
   * Амплитуда неровностей пола, м. Сама сетка высот не хранится: она
   * выводится из seed и этого числа (см. reliefFor). Так состояние
   * переживает поездку в Postgres и обратно без потерь.
   */
  reliefAmp: number
  /** seed матча и курсор PRNG — вся случайность детерминирована ими */
  seed: number
  rngCursor: number
  tick: number
}

/**
 * Вход броска. Направление, угол подъёма и сила уже переведены в скорость
 * и КВАНТОВАНЫ. Именно эти числа уходят по сети — не угол и не пиксели тяги.
 */
export interface ThrowInput {
  vx: number
  vy: number
  vz: number
  /** начальная подкрутка, влияет только на кувыркание меша */
  spin: number
  originX: number
  originY: number
}

export type SimEvent =
  /** касание земли: для пыли, отпечатка и звука поверхности */
  | { type: 'groundImpact'; tick: number; bodyId: number; speed: number; x: number; y: number }
  /** столкновение тел; inAir — цель была в воздухе («Тура!») */
  | {
      type: 'bodyHit'
      tick: number
      a: number
      b: number
      impulse: number
      inAir: boolean
      x: number
      y: number
      z: number
    }
  /** асық пересёк линию поля — только для эффекта, очко считается по покою */
  | { type: 'knockOut'; tick: number; bodyId: number; x: number; y: number }
  /** сақа прошла впритирку и не задела */
  | { type: 'nearMiss'; tick: number; bodyId: number; distance: number }
  | { type: 'wallBounce'; tick: number; bodyId: number; impulse: number }
  /** сақа остановилась: inside — внутри кона (штраф по правилу 5) */
  | { type: 'sakaRest'; tick: number; inside: boolean; x: number; y: number }
  | { type: 'sakaLost'; tick: number }

/** Кадр для анимации. */
export interface FrameBody {
  id: number
  x: number
  y: number
  z: number
  tumble: number
  yaw: number
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
