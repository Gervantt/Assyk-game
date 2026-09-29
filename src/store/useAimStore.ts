import { create } from 'zustand'
import type { AimState } from '@/physics'

interface AimStore extends AimState {
  /** точка старта сақа на линии броска (мировые координаты физики) */
  originX: number
  originY: number
  setAim: (a: AimState) => void
  reset: () => void
}

const IDLE: AimState = { dirX: 0, dirY: 1, elevation: 0, power: 0, active: false }

/**
 * Состояние прицела обновляется на каждое движение указателя.
 * Подписчики — только шкала силы и индикатор, остальной UI не перерисовывается.
 */
export const useAimStore = create<AimStore>((set) => ({
  ...IDLE,
  originX: 0,
  originY: 0,
  setAim: (a) => set(a),
  reset: () => set(IDLE),
}))
