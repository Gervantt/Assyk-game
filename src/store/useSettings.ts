import { create } from 'zustand'

const KEY = 'asyq.settings.v1'

export type EffectsLevel = 'full' | 'medium' | 'low'

export interface Settings {
  sound: boolean
  volume: number
  effects: EffectsLevel
  haptics: boolean
  /** фоновый күй во время игры */
  music: boolean
  musicVolume: number
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function load(): Settings {
  const fallback: Settings = {
    music: true,
    musicVolume: 0.45,
    sound: true,
    volume: 0.7,
    effects: prefersReducedMotion() ? 'low' : 'full',
    haptics: true,
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Partial<Settings> & { effects?: string }
    // раньше уровней было два; 'reduced' переносим в 'low'
    const effects: EffectsLevel =
      saved.effects === 'full' || saved.effects === 'medium' || saved.effects === 'low'
        ? saved.effects
        : saved.effects === 'reduced'
          ? 'low'
          : fallback.effects
    return { ...fallback, ...saved, effects }
  } catch {
    return fallback
  }
}

function persist(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* приватный режим — настройки живут только до перезагрузки */
  }
}

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  set: (key, value) => {
    set({ [key]: value } as Pick<Settings, typeof key>)
    const { sound, volume, effects, haptics, music, musicVolume } = get()
    persist({ sound, volume, effects, haptics, music, musicVolume })
  },
}))

/** Снимок настроек вне React — для useFrame и звука. */
export function settings(): Settings {
  const s = useSettings.getState()
  return {
    sound: s.sound,
    volume: s.volume,
    effects: s.effects,
    haptics: s.haptics,
    music: s.music,
    musicVolume: s.musicVolume,
  }
}

export function effectsLevel(): EffectsLevel {
  return useSettings.getState().effects
}

/** Нужны ли «дорогие» эффекты: частицы, слоу-мо, конфетти. */
export function richEffects(): boolean {
  return useSettings.getState().effects !== 'low'
}

/** Полные эффекты: тряска, наезд камеры, ударные волны. */
export function fullEffects(): boolean {
  return useSettings.getState().effects === 'full'
}

/** Системная настройка «меньше движения» — уважаем её всегда. */
export function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
