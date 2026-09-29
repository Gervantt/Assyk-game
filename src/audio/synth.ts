import { mulberry32 } from '@/physics'

/**
 * Синтез звуков в WAV прямо в браузере. Готовых аудиофайлов в проекте нет —
 * и лицензионных вопросов тоже. Каждый звук детерминирован (seeded PRNG),
 * поэтому звучит одинаково при каждом запуске.
 */

const RATE = 22050

function encodeWav(samples: Float32Array): string {
  const n = samples.length
  const buf = new ArrayBuffer(44 + n * 2)
  const view = new DataView(buf)
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  view.setUint32(4, 36 + n * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, RATE, true)
  view.setUint32(28, RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  str(36, 'data')
  view.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return `data:audio/wav;base64,${btoa(bin)}`
}

const TAU = Math.PI * 2

interface Voice {
  (t: number, i: number, rnd: () => number, state: { lp: number; bp: number }): number
}

function render(durationSec: number, voice: Voice, seed: number): string {
  const n = Math.floor(durationSec * RATE)
  const out = new Float32Array(n)
  const rnd = mulberry32(seed)
  const state = { lp: 0, bp: 0 }
  for (let i = 0; i < n; i++) {
    out[i] = voice(i / RATE, i, rnd, state)
  }
  // мягкий фейд на концах, чтобы не было щелчков
  const fade = Math.min(64, Math.floor(n / 8))
  for (let i = 0; i < fade; i++) {
    out[i]! *= i / fade
    out[n - 1 - i]! *= i / fade
  }
  return encodeWav(out)
}

const decay = (t: number, k: number) => Math.exp(-t * k)

/** Щелчок кости: шумовой удар плюс два резонанса. Варианты чуть различаются. */
function boneClick(variant: number): string {
  const base = 1500 + variant * 420
  return render(
    0.14,
    (t, _i, rnd, st) => {
      const noise = rnd() * 2 - 1
      st.lp += (noise - st.lp) * 0.55
      const body = st.lp * decay(t, 90) * 0.85
      const ring =
        Math.sin(TAU * base * t) * decay(t, 42) * 0.32 +
        Math.sin(TAU * base * 1.87 * t) * decay(t, 60) * 0.18
      const knock = Math.sin(TAU * 220 * t) * decay(t, 130) * 0.25
      return (body + ring + knock) * 0.9
    },
    1000 + variant,
  )
}

/** Монетка-колокольчик на выбитый асық. */
function coin(): string {
  return render(
    0.55,
    (t) => {
      const a = Math.sin(TAU * 1318 * t) * decay(t, 7) * 0.4
      const b = Math.sin(TAU * 1976 * t) * decay(t, 9) * 0.3
      const c = Math.sin(TAU * 2637 * t) * decay(t, 14) * 0.16
      return (a + b + c) * Math.min(1, t * 90)
    },
    7,
  )
}

/** Восходящее арпеджио на комбо. */
function combo(): string {
  const notes = [523, 659, 784, 1047]
  return render(
    0.62,
    (t) => {
      let v = 0
      notes.forEach((f, i) => {
        const start = i * 0.075
        if (t < start) return
        const u = t - start
        v += Math.sin(TAU * f * u) * decay(u, 6) * 0.26
      })
      return v
    },
    11,
  )
}

/** Свист сақа в полёте. */
function whoosh(): string {
  return render(
    0.34,
    (t, _i, rnd, st) => {
      const noise = rnd() * 2 - 1
      const cut = 0.06 + 0.3 * Math.sin(Math.PI * Math.min(t / 0.34, 1))
      st.lp += (noise - st.lp) * cut
      st.bp += (st.lp - st.bp) * 0.04
      const band = st.lp - st.bp
      const env = Math.sin(Math.PI * Math.min(t / 0.34, 1))
      return band * env * 0.5
    },
    23,
  )
}

/** Глухой удар о землю. */
function thud(): string {
  return render(
    0.26,
    (t, _i, rnd, st) => {
      const f = 95 - 42 * Math.min(t / 0.2, 1)
      const tone = Math.sin(TAU * f * t) * decay(t, 16) * 0.65
      const noise = rnd() * 2 - 1
      st.lp += (noise - st.lp) * 0.2
      return tone + st.lp * decay(t, 70) * 0.3
    },
    31,
  )
}

/** Штраф: короткий нисходящий сигнал. */
function penalty(): string {
  return render(
    0.42,
    (t) => {
      const f = 420 - 190 * Math.min(t / 0.35, 1)
      return Math.sin(TAU * f * t) * decay(t, 8) * 0.42
    },
    41,
  )
}

/** Победа: короткая фанфара. */
function win(): string {
  const notes = [523, 659, 784, 1047, 1319]
  return render(
    1.25,
    (t) => {
      let v = 0
      notes.forEach((f, i) => {
        const start = i * 0.115
        if (t < start) return
        const u = t - start
        v += (Math.sin(TAU * f * u) + Math.sin(TAU * f * 2 * u) * 0.25) * decay(u, 3.4) * 0.2
      })
      return v
    },
    53,
  )
}

/** Нажатие в интерфейсе. */
function tap(): string {
  return render(
    0.05,
    (t) => Math.sin(TAU * 900 * t) * decay(t, 90) * 0.35,
    61,
  )
}

export const SOUND_SOURCES = {
  bone1: () => boneClick(0),
  bone2: () => boneClick(1),
  bone3: () => boneClick(2),
  coin,
  combo,
  whoosh,
  thud,
  penalty,
  win,
  tap,
} as const

export type SoundName = keyof typeof SOUND_SOURCES
