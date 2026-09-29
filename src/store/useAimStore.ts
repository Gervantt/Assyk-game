import { create } from 'zustand'
import { IDLE_AIM, type AimState } from '@/physics'

/** Стадия жеста: сначала выбираем направление, потом натягиваем. */
export type AimMode = 'idle' | 'direction' | 'pull'

interface AimStore extends AimState {
  /** поворот направления броска, радианы; хранится между бросками */
  yaw: number
  mode: AimMode
  /** id асыка, выбранного тапом; null — цель не выбрана */
  targetId: number | null
  /** точка старта сақа на линии броска (мировые координаты физики) */
  originX: number
  originY: number
  setAim: (a: Partial<AimStore>) => void
  setYaw: (yaw: number) => void
  setMode: (mode: AimMode) => void
  setTarget: (id: number | null) => void
  reset: () => void
}

/**
 * Состояние прицела обновляется на каждое движение указателя.
 * Подписчики — только шкала силы и индикатор, остальной UI не перерисовывается.
 */
export const useAimStore = create<AimStore>((set) => ({
  ...IDLE_AIM,
  yaw: 0,
  mode: 'idle',
  targetId: null,
  originX: 0,
  originY: 0,
  setAim: (a) => set(a),
  // ручной поворот снимает выбранную тапом цель: игрок целится сам
  setYaw: (yaw) => set({ yaw, targetId: null }),
  setMode: (mode) => set({ mode }),
  setTarget: (targetId) => set({ targetId }),
  // направление переживает бросок: игрок целится дальше от той же линии
  reset: () => set({ ...IDLE_AIM, mode: 'idle' }),
}))
