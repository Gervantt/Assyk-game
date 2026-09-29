import { create } from 'zustand'

export interface Popup {
  id: number
  left: number
  top: number
  text: string
}

interface PopupStore {
  items: Popup[]
  push: (left: number, top: number, text: string) => void
  drop: (id: number) => void
  clear: () => void
}

let nextId = 0

/** Всплывающие «+1» живут в экранных координатах: спроецировали один раз при появлении. */
export const usePopupStore = create<PopupStore>((set) => ({
  items: [],
  push: (left, top, text) =>
    set((s) => ({ items: [...s.items.slice(-5), { id: nextId++, left, top, text }] })),
  drop: (id) => set((s) => ({ items: s.items.filter((p) => p.id !== id) })),
  clear: () => set({ items: [] }),
}))
