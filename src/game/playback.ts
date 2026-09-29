import { PHYSICS, type Frame, type SimEvent } from '@/physics'

/** Длительность одного записанного кадра, сек. */
export const FRAME_DT = PHYSICS.dt * PHYSICS.frameEvery

/** Пауза после последнего кадра, чтобы успели дочитаться надписи. */
const TAIL_SECONDS = 0.4

/**
 * План эффектов броска. Считается ДО проигрывания: события уже известны,
 * поэтому режиссёр знает, где и когда будет удар, и успевает заморозить
 * кадр ровно в момент касания, а не спустя два кадра после него.
 */
export interface FxPlan {
  /** тик первого значимого удара сақа по асыку; -1 — удара не будет */
  hitTick: number
  /** сколько держать замороженный кадр, сек реального времени */
  hitStop: number
  /** длительность и глубина замедления после заморозки */
  slowMo: number
  slowMoScale: number
  /** точка, к которой наезжает камера */
  focusX: number
  focusY: number
  /** сколько асыков будет выбито этим броском — ступень эскалации */
  combo: number
  /** множитель силы эффектов от эскалации */
  intensity: number
}

const EMPTY_PLAN: FxPlan = {
  hitTick: -1,
  hitStop: 0,
  slowMo: 0,
  slowMoScale: 1,
  focusX: 0,
  focusY: 0,
  combo: 0,
  intensity: 1,
}

interface Runtime {
  active: boolean
  frames: Frame[]
  events: SimEvent[]
  /** виртуальное время от начала броска, сек */
  t: number
  /** индекс следующего необработанного события */
  cursor: number
  plan: FxPlan
  /** остаток заморозки кадра, сек реального времени */
  frozenLeft: number
  /** остаток замедления, сек реального времени */
  slowMoLeft: number
  duration: number
  finished: boolean
}

const rt: Runtime = {
  active: false,
  frames: [],
  events: [],
  t: 0,
  cursor: 0,
  plan: { ...EMPTY_PLAN },
  frozenLeft: 0,
  slowMoLeft: 0,
  duration: 0,
  finished: false,
}

export function getPlayback(): Readonly<Runtime> {
  return rt
}

export function playbackPlan(): Readonly<FxPlan> {
  return rt.plan
}

export function playbackTimeScale(): number {
  if (rt.frozenLeft > 0) return 0
  return rt.slowMoLeft > 0 ? rt.plan.slowMoScale : 1
}

/** Идёт ли сейчас «кинематографичный» момент — камере пора наезжать. */
export function playbackImpact(): boolean {
  return rt.active && (rt.frozenLeft > 0 || rt.slowMoLeft > 0)
}

/**
 * Строит план по событиям. «Сила» эффекта растёт со ступенью комбо:
 * чем больше асыков уйдёт за этим броском, тем дольше замедление,
 * сильнее тряска и громче реакция.
 */
export function buildPlan(events: SimEvent[], rich: boolean, reducedMotion: boolean): FxPlan {
  const knockOuts = events.filter((e) => e.type === 'knockOut')
  const combo = knockOuts.length
  if (!rich) return { ...EMPTY_PLAN, combo }

  // первый удар сақа по телу — вокруг него и строится момент
  const firstHit = events.find((e) => e.type === 'bodyHit' && (e.a === 0 || e.b === 0))
  if (!firstHit || firstHit.type !== 'bodyHit') return { ...EMPTY_PLAN, combo }

  const tier = Math.min(combo, 4)
  const intensity = 1 + tier * 0.35
  return {
    hitTick: firstHit.tick,
    // при включённом prefers-reduced-motion момент короче, но не исчезает
    hitStop: reducedMotion ? 0.035 : 0.06 + tier * 0.008,
    slowMo: combo === 0 ? 0.18 : reducedMotion ? 0.2 : 0.4 + tier * 0.06,
    slowMoScale: combo >= 2 ? 0.3 : 0.55,
    focusX: firstHit.x,
    focusY: firstHit.y,
    combo,
    intensity,
  }
}

export function beginPlayback(frames: Frame[], events: SimEvent[], plan: FxPlan): void {
  rt.active = true
  rt.frames = frames
  rt.events = events
  rt.t = 0
  rt.cursor = 0
  rt.plan = plan
  rt.frozenLeft = 0
  rt.slowMoLeft = 0
  rt.finished = false
  rt.duration = (frames[frames.length - 1]?.tick ?? 0) * PHYSICS.dt
}

export function stopPlayback(): void {
  rt.active = false
  rt.frames = []
  rt.events = []
  rt.frozenLeft = 0
  rt.slowMoLeft = 0
  rt.plan = { ...EMPTY_PLAN }
}

/**
 * Двигает виртуальные часы и возвращает события, наступившие за этот кадр.
 * realDt — настоящая дельта кадра; внутри применяется масштаб времени.
 */
export function advancePlayback(realDt: number): SimEvent[] {
  if (!rt.active) return []
  const dt = Math.min(realDt, 0.05)

  // заморозка кадра: время стоит, события не наступают
  if (rt.frozenLeft > 0) {
    rt.frozenLeft -= dt
    return []
  }
  if (rt.slowMoLeft > 0) rt.slowMoLeft -= dt

  rt.t += dt * playbackTimeScale()
  const currentTick = rt.t / PHYSICS.dt

  const fired: SimEvent[] = []
  while (rt.cursor < rt.events.length && rt.events[rt.cursor]!.tick <= currentTick) {
    fired.push(rt.events[rt.cursor]!)
    rt.cursor++
  }

  // момент удара: замораживаем кадр, следом включаем замедление
  if (rt.plan.hitTick >= 0 && currentTick >= rt.plan.hitTick) {
    rt.frozenLeft = rt.plan.hitStop
    rt.slowMoLeft = rt.plan.slowMo + rt.plan.hitStop
    rt.plan = { ...rt.plan, hitTick: -1 }
  }

  if (!rt.finished && rt.t >= rt.duration + TAIL_SECONDS) rt.finished = true
  return fired
}

export function playbackIsFinished(): boolean {
  return rt.finished
}

/** Кадр, ближайший к текущему виртуальному времени (для следа и камеры). */
export function currentFrameIndex(): number {
  if (rt.frames.length === 0) return 0
  return Math.min(Math.floor(rt.t / FRAME_DT), rt.frames.length - 1)
}
