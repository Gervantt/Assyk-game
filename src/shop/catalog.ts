import type { DictKey } from '@/i18n'

/**
 * Каталог косметики.
 *
 * ВАЖНО: этот модуль НЕ должен попадать в src/physics — ни прямо, ни через
 * цепочку импортов. Скин влияет только на то, как предмет выглядит; полёт,
 * отскок и трение у золотой сақа ровно те же, что у обычной. Это проверяет
 * тест src/shop/__tests__/isolation.test.ts.
 *
 * Цены здесь — только для показа. Настоящие лежат в таблице shop_items и
 * проверяются сервером при покупке.
 */
export type ItemKind = 'saka' | 'arena' | 'trail' | 'pack' | 'tool'

export interface ShopItem {
  id: string
  kind: ItemKind
  title: DictKey
  desc: DictKey
  /** цена в тиынах; 0 — бесплатно или продаётся за деньги */
  coins: number
  /** цена в тестовом режиме, ₸; 0 — за деньги не продаётся */
  kzt: number
}

/** Внешний вид сақа: только цвет и материал. */
export interface SakaLook {
  color: string
  emissive: string
  roughness: number
  metalness: number
}

/** Внешний вид арены: цвет земли и неба. Поверхность (трение) сюда не входит. */
export interface ArenaLook {
  ground: string
  sky: string
  sun: string
  /** плотность пыли, 0..1 — чистое оформление */
  haze: number
}

export interface TrailLook {
  color: string
  width: number
}

export const SAKA_LOOKS: Record<string, SakaLook> = {
  'saka.red': { color: '#c33a25', emissive: '#c33a25', roughness: 0.34, metalness: 0.3 },
  'saka.bone': { color: '#efe3c6', emissive: '#7d6a45', roughness: 0.72, metalness: 0.02 },
  'saka.silver': { color: '#cfd6dd', emissive: '#8f9aa6', roughness: 0.22, metalness: 0.85 },
  'saka.gold': { color: '#e8b53a', emissive: '#a5761a', roughness: 0.18, metalness: 0.95 },
  'saka.oyu': { color: '#2f6f6b', emissive: '#c99a3c', roughness: 0.4, metalness: 0.45 },
}

export const ARENA_LOOKS: Record<string, ArenaLook> = {
  'arena.aul': { ground: '#c4a678', sky: '#1d2a3d', sun: '#ffe6bd', haze: 0.35 },
  'arena.almaty': { ground: '#9c927f', sky: '#26303a', sun: '#ffd9a8', haze: 0.55 },
  'arena.jailau': { ground: '#a9b077', sky: '#1b3350', sun: '#fff1c9', haze: 0.2 },
  'arena.winter': { ground: '#dfe6ee', sky: '#2b3b52', sun: '#dceaff', haze: 0.7 },
}

export const TRAIL_LOOKS: Record<string, TrailLook> = {
  'trail.dust': { color: '#d8c9a8', width: 1 },
  'trail.spark': { color: '#ff9f43', width: 1.25 },
  'trail.gold': { color: '#f2c14e', width: 1.6 },
}

export const DEFAULTS = {
  saka: 'saka.red',
  arena: 'arena.aul',
  trail: 'trail.dust',
} as const

/** Бесплатное доступно сразу — иначе новый игрок остался бы без вида вовсе. */
export const FREE_ITEMS = new Set<string>([DEFAULTS.saka, DEFAULTS.arena, DEFAULTS.trail])

export const CATALOG: ShopItem[] = [
  { id: 'saka.red', kind: 'saka', title: 'shop.saka.red', desc: 'shop.saka.red.d', coins: 0, kzt: 0 },
  { id: 'saka.bone', kind: 'saka', title: 'shop.saka.bone', desc: 'shop.saka.bone.d', coins: 120, kzt: 0 },
  { id: 'saka.silver', kind: 'saka', title: 'shop.saka.silver', desc: 'shop.saka.silver.d', coins: 260, kzt: 0 },
  { id: 'saka.gold', kind: 'saka', title: 'shop.saka.gold', desc: 'shop.saka.gold.d', coins: 540, kzt: 0 },
  { id: 'saka.oyu', kind: 'saka', title: 'shop.saka.oyu', desc: 'shop.saka.oyu.d', coins: 0, kzt: 990 },

  { id: 'arena.aul', kind: 'arena', title: 'shop.arena.aul', desc: 'shop.arena.aul.d', coins: 0, kzt: 0 },
  { id: 'arena.almaty', kind: 'arena', title: 'shop.arena.almaty', desc: 'shop.arena.almaty.d', coins: 180, kzt: 0 },
  { id: 'arena.jailau', kind: 'arena', title: 'shop.arena.jailau', desc: 'shop.arena.jailau.d', coins: 320, kzt: 0 },
  { id: 'arena.winter', kind: 'arena', title: 'shop.arena.winter', desc: 'shop.arena.winter.d', coins: 0, kzt: 990 },

  { id: 'trail.dust', kind: 'trail', title: 'shop.trail.dust', desc: 'shop.trail.dust.d', coins: 0, kzt: 0 },
  { id: 'trail.spark', kind: 'trail', title: 'shop.trail.spark', desc: 'shop.trail.spark.d', coins: 150, kzt: 0 },
  { id: 'trail.gold', kind: 'trail', title: 'shop.trail.gold', desc: 'shop.trail.gold.d', coins: 0, kzt: 690 },

  { id: 'pack.uly-dala', kind: 'pack', title: 'shop.pack.dala', desc: 'shop.pack.dala.d', coins: 0, kzt: 1490 },
  { id: 'pack.tarih', kind: 'pack', title: 'shop.pack.tarih', desc: 'shop.pack.tarih.d', coins: 0, kzt: 1490 },
  { id: 'tool.tournament', kind: 'tool', title: 'shop.tool.tournament', desc: 'shop.tool.tournament.d', coins: 0, kzt: 2490 },
]

export function itemById(id: string): ShopItem | undefined {
  return CATALOG.find((i) => i.id === id)
}
