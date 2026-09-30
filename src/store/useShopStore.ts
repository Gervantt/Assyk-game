import { create } from 'zustand'
import { DEFAULTS, FREE_ITEMS, type ArenaLook, type SakaLook, type TrailLook } from '@/shop/catalog'
import { ARENA_LOOKS, SAKA_LOOKS, TRAIL_LOOKS } from '@/shop/catalog'
import { buyItem, equipItem, fetchOwned, type EquipMap } from '@/net/shop'
import { useAuthStore } from './useAuthStore'

const LOCAL_KEY = 'asyq.equipped.v1'

/**
 * Что куплено и что надето.
 *
 * Без сети магазин показывается, но покупки недоступны: их подтверждает
 * сервер. Выбор бесплатного вида хранится локально, чтобы игра оставалась
 * настраиваемой офлайн.
 */
interface ShopStore {
  owned: Set<string>
  equipped: Required<EquipMap>
  coins: number
  busy: string | null
  error: 'coins' | 'offline' | 'failed' | null

  load: () => Promise<void>
  buy: (itemId: string) => Promise<boolean>
  equip: (itemId: string, kind: 'saka' | 'arena' | 'trail') => Promise<void>
  clearError: () => void
}

function loadLocal(): Required<EquipMap> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as EquipMap) }
  } catch {
    /* приватный режим — останемся на значениях по умолчанию */
  }
  return { ...DEFAULTS }
}

function saveLocal(equipped: Required<EquipMap>): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(equipped))
  } catch {
    /* не критично: вид сбросится к стандартному */
  }
}

export const useShopStore = create<ShopStore>((set, get) => ({
  owned: new Set(FREE_ITEMS),
  equipped: loadLocal(),
  coins: 0,
  busy: null,
  error: null,

  load: async () => {
    const { profile } = useAuthStore.getState()
    if (!profile) return
    const owned = await fetchOwned(profile.id)
    const fromProfile = (profile as unknown as { equipped?: EquipMap }).equipped ?? {}
    const equipped = { ...loadLocal(), ...fromProfile }
    saveLocal(equipped)
    set({
      owned: new Set([...FREE_ITEMS, ...owned]),
      coins: profile.coins,
      equipped,
    })
  },

  buy: async (itemId) => {
    set({ busy: itemId, error: null })
    const res = await buyItem(itemId)
    if ('error' in res) {
      set({ busy: null, error: res.error as ShopStore['error'] })
      return false
    }
    set((s) => ({
      busy: null,
      coins: res.coins,
      owned: new Set([...s.owned, itemId]),
    }))
    void useAuthStore.getState().reload()
    return true
  },

  equip: async (itemId, kind) => {
    if (!get().owned.has(itemId)) return
    // отзываемся сразу: ждать сервер, чтобы поменять цвет, незачем
    const equipped = { ...get().equipped, [kind]: itemId }
    set({ equipped })
    saveLocal(equipped)
    const server = await equipItem(itemId)
    if (server) {
      const merged = { ...equipped, ...server }
      set({ equipped: merged })
      saveLocal(merged)
    }
  },

  clearError: () => set({ error: null }),
}))

/** Вид сақа по надетому скину. Физика этих значений не видит. */
export function useSakaLook(): SakaLook {
  const id = useShopStore((s) => s.equipped.saka)
  return SAKA_LOOKS[id] ?? SAKA_LOOKS[DEFAULTS.saka]!
}

export function useArenaLook(): ArenaLook {
  const id = useShopStore((s) => s.equipped.arena)
  return ARENA_LOOKS[id] ?? ARENA_LOOKS[DEFAULTS.arena]!
}

export function useTrailLook(): TrailLook {
  const id = useShopStore((s) => s.equipped.trail)
  return TRAIL_LOOKS[id] ?? TRAIL_LOOKS[DEFAULTS.trail]!
}
