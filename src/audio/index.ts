import { Howl, Howler } from 'howler'
import { settings, useSettings } from '@/store/useSettings'
import { SOUND_SOURCES, type SoundName } from './synth'

/**
 * Звук разведён по шинам с отдельными громкостями и ограничением
 * одновременных голосов: пять ударов подряд не должны превращаться в кашу.
 */
export type Bus = 'music' | 'ambience' | 'sfx' | 'crowd'

const BUS_VOLUME: Record<Bus, number> = {
  music: 0.35,
  ambience: 0.4,
  sfx: 1,
  crowd: 0.7,
}

/** Сколько звуков шины можно запустить за окно LIMIT_WINDOW. */
const BUS_LIMIT: Record<Bus, number> = { music: 1, ambience: 2, sfx: 4, crowd: 3 }
const LIMIT_WINDOW = 130

const BUS_OF: Record<SoundName, Bus> = {
  bone1: 'sfx',
  bone2: 'sfx',
  bone3: 'sfx',
  bone4: 'sfx',
  bone5: 'sfx',
  bone6: 'sfx',
  coin: 'sfx',
  combo: 'crowd',
  whoosh: 'sfx',
  thud: 'sfx',
  penalty: 'crowd',
  win: 'crowd',
  tap: 'sfx',
}

const pool = new Map<SoundName, Howl>()
const recent: Record<Bus, number[]> = { music: [], ambience: [], sfx: [], crowd: [] }
let unlocked = false

function get(name: SoundName): Howl | null {
  const cached = pool.get(name)
  if (cached) return cached
  try {
    const howl = new Howl({ src: [SOUND_SOURCES[name]()], format: ['wav'], preload: true })
    pool.set(name, howl)
    return howl
  } catch {
    return null
  }
}

/** true, если шина ещё не исчерпала лимит голосов. */
function allow(bus: Bus): boolean {
  const now = performance.now()
  const list = recent[bus]
  while (list.length > 0 && now - list[0]! > LIMIT_WINDOW) list.shift()
  if (list.length >= BUS_LIMIT[bus]) return false
  list.push(now)
  return true
}

export interface PlayOptions {
  /** множитель высоты тона, 0.5..3 */
  rate?: number
  /** множитель громкости, 0..1 */
  volume?: number
  /** координата x источника в мире — превращается в панораму */
  pan?: number
}

export function playSound(name: SoundName, opts: PlayOptions = {}): void {
  const s = settings()
  if (!s.sound || s.volume <= 0) return
  const bus = BUS_OF[name]
  if (!allow(bus)) return

  const howl = get(name)
  if (!howl) return
  const id = howl.play()
  howl.rate(Math.max(0.5, Math.min(3, opts.rate ?? 1)), id)
  howl.volume(
    Math.max(0, Math.min(1, (opts.volume ?? 1) * BUS_VOLUME[bus] * s.volume)),
    id,
  )
  if (opts.pan !== undefined) {
    try {
      // лёгкая пространственность: удар слева слышно слева
      howl.stereo(Math.max(-1, Math.min(1, opts.pan / 3)) * 0.6, id)
    } catch {
      /* без плагина стерео звук просто останется по центру */
    }
  }
}

const BONES: SoundName[] = ['bone1', 'bone2', 'bone3', 'bone4', 'bone5', 'bone6']

/** Щелчок кости: высота тона и громкость зависят от силы удара. */
export function playBoneHit(impulse: number, x = 0): void {
  const norm = Math.max(0, Math.min(1, impulse / 7))
  const variant = BONES[Math.floor(norm * (BONES.length - 0.01))]!
  playSound(variant, { rate: 0.82 + norm * 0.65, volume: 0.35 + norm * 0.6, pan: x })
}

/**
 * Разблокировка звука после первого жеста: браузеры не дают играть раньше.
 * Заодно прогреваем самые частые звуки, чтобы первый удар не запаздывал.
 */
export function unlockAudio(): void {
  if (unlocked) return
  unlocked = true
  try {
    Howler.volume(1)
    get('bone1')
    get('bone3')
    get('coin')
    get('whoosh')
  } catch {
    /* звук просто не заработает — игра от этого не ломается */
  }
}

useSettings.subscribe((s) => {
  try {
    Howler.mute(!s.sound)
  } catch {
    /* ignore */
  }
})

export type { SoundName }
