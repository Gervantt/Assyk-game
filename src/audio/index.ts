import { Howl, Howler } from 'howler'
import { settings, useSettings } from '@/store/useSettings'
import { SOUND_SOURCES, type SoundName } from './synth'

/**
 * Обёртка над howler. Звуки синтезируются лениво, при первом обращении:
 * так загрузка страницы не ждёт генерации WAV, а браузер не ругается
 * на автовоспроизведение до жеста пользователя.
 */

const pool = new Map<SoundName, Howl>()
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

export interface PlayOptions {
  /** множитель высоты тона, 0.5..3 */
  rate?: number
  /** множитель громкости, 0..1 */
  volume?: number
}

export function playSound(name: SoundName, opts: PlayOptions = {}): void {
  const s = settings()
  if (!s.sound || s.volume <= 0) return
  const howl = get(name)
  if (!howl) return
  const id = howl.play()
  howl.rate(Math.max(0.5, Math.min(3, opts.rate ?? 1)), id)
  howl.volume(Math.max(0, Math.min(1, (opts.volume ?? 1) * s.volume)), id)
}

/** Щелчок кости: высота тона зависит от силы удара. */
export function playBoneHit(impulse: number): void {
  const norm = Math.max(0, Math.min(1, impulse / 7))
  const variant = (['bone1', 'bone2', 'bone3'] as const)[Math.floor(norm * 2.99)]!
  playSound(variant, { rate: 0.82 + norm * 0.65, volume: 0.35 + norm * 0.6 })
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
    get('coin')
    get('whoosh')
  } catch {
    /* звук просто не заработает — игра от этого не ломается */
  }
}

/** Общая громкость меняется вместе с настройками. */
useSettings.subscribe((s) => {
  try {
    Howler.mute(!s.sound)
  } catch {
    /* ignore */
  }
})

export type { SoundName }
