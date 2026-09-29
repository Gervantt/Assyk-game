import { create } from 'zustand'

export interface Popup {
  id: number
  left: number
  top: number
  text: string
}

/** Асық, улетающий дугой в копилку игрока в HUD. */
export interface Coin {
  id: number
  left: number
  top: number
  dx: number
  dy: number
}

interface PopupStore {
  items: Popup[]
  coins: Coin[]
  push: (left: number, top: number, text: string) => void
  pushCoin: (left: number, top: number, dx: number, dy: number) => void
  drop: (id: number) => void
  dropCoin: (id: number) => void
  clear: () => void
}

let nextId = 0

/** Всплывающие «+1» живут в экранных координатах: спроецировали один раз при появлении. */
export const usePopupStore = create<PopupStore>((set) => ({
  items: [],
  coins: [],
  push: (left, top, text) =>
    set((s) => ({ items: [...s.items.slice(-5), { id: nextId++, left, top, text }] })),
  pushCoin: (left, top, dx, dy) =>
    set((s) => ({ coins: [...s.coins.slice(-6), { id: nextId++, left, top, dx, dy }] })),
  drop: (id) => set((s) => ({ items: s.items.filter((p) => p.id !== id) })),
  dropCoin: (id) => set((s) => ({ coins: s.coins.filter((c) => c.id !== id) })),
  clear: () => set({ items: [], coins: [] }),
}))
