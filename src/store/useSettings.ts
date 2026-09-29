import { create } from 'zustand'

const KEY = 'asyq.settings.v1'

export type EffectsLevel = 'full' | 'reduced'

export interface Settings {
  sound: boolean
  volume: number
  effects: EffectsLevel
  haptics: boolean
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
    sound: true,
    volume: 0.7,
    effects: prefersReducedMotion() ? 'reduced' : 'full',
    haptics: true,
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as Partial<Settings>) }
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
    const { sound, volume, effects, haptics } = get()
    persist({ sound, volume, effects, haptics })
  },
}))

/** Снимок настроек вне React — для useFrame и звука. */
export function settings(): Settings {
  const s = useSettings.getState()
  return { sound: s.sound, volume: s.volume, effects: s.effects, haptics: s.haptics }
}

/** Полные эффекты включены? Учитывает и настройку, и prefers-reduced-motion. */
export function fullEffects(): boolean {
  return useSettings.getState().effects === 'full'
}
