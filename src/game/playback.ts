import { PHYSICS, type Frame, type SimEvent } from '@/physics'

/** Длительность одного записанного кадра, сек. */
export const FRAME_DT = PHYSICS.dt * PHYSICS.frameEvery

/** Замедление на мульти-выбивании: 0.3x на 0.6 с реального времени. */
const SLOWMO_SCALE = 0.3
const SLOWMO_SECONDS = 0.6
/** Пауза после последнего кадра, чтобы успели дочитаться надписи. */
const TAIL_SECONDS = 0.35

interface Runtime {
  active: boolean
  frames: Frame[]
  events: SimEvent[]
  /** виртуальное время от начала броска, сек */
  t: number
  /** индекс следующего необработанного события */
  cursor: number
  /** тик, на котором включается слоумо; -1 — не нужно */
  slowMoTick: number
  /** сколько реального времени осталось в замедлении */
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
  slowMoTick: -1,
  slowMoLeft: 0,
  duration: 0,
  finished: false,
}

export function getPlayback(): Readonly<Runtime> {
  return rt
}

export function playbackTimeScale(): number {
  return rt.slowMoLeft > 0 ? SLOWMO_SCALE : 1
}

/**
 * Начинает проигрывание броска. Слоумо планируется заранее: события уже
 * посчитаны, поэтому известно, будет ли мульти-выбивание, и на каком тике.
 */
export function beginPlayback(frames: Frame[], events: SimEvent[], allowSlowMo: boolean): void {
  const knockOuts = events.filter((e) => e.type === 'knockOut')
  rt.active = true
  rt.frames = frames
  rt.events = events
  rt.t = 0
  rt.cursor = 0
  rt.slowMoLeft = 0
  rt.finished = false
  rt.slowMoTick = allowSlowMo && knockOuts.length >= 2 ? knockOuts[0]!.tick : -1
  rt.duration = (frames[frames.length - 1]?.tick ?? 0) * PHYSICS.dt
}

export function stopPlayback(): void {
  rt.active = false
  rt.frames = []
  rt.events = []
  rt.slowMoLeft = 0
}

/**
 * Двигает виртуальные часы и возвращает события, наступившие за этот кадр.
 * realDt — настоящая дельта кадра; внутри применяется масштаб времени.
 */
export function advancePlayback(realDt: number): SimEvent[] {
  if (!rt.active) return []

  const dt = Math.min(realDt, 0.05)
  if (rt.slowMoLeft > 0) rt.slowMoLeft -= dt
  rt.t += dt * playbackTimeScale()

  const currentTick = rt.t / PHYSICS.dt
  const fired: SimEvent[] = []
  while (rt.cursor < rt.events.length && rt.events[rt.cursor]!.tick <= currentTick) {
    const e = rt.events[rt.cursor]!
    fired.push(e)
    rt.cursor++
  }

  if (rt.slowMoTick >= 0 && currentTick >= rt.slowMoTick) {
    rt.slowMoLeft = SLOWMO_SECONDS
    rt.slowMoTick = -1
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
