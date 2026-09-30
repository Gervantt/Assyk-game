import { backendReady, netWarn, supabase } from './supabase'

export interface EquipMap {
  saka?: string
  arena?: string
  trail?: string
}

/** Что уже куплено. Бесплатное в purchases не лежит — оно доступно всегда. */
export async function fetchOwned(userId: string): Promise<string[]> {
  if (!backendReady() || !supabase) return []
  const { data, error } = await supabase
    .from('purchases')
    .select('item_id')
    .eq('user_id', userId)
  if (error) {
    netWarn('fetchOwned', error)
    return []
  }
  return (data as Array<{ item_id: string }>).map((r) => r.item_id)
}

export interface BuyResult {
  coins: number
  testMode: boolean
}

/**
 * Покупка. Цену и наличие тиынов проверяет сервер: в браузере их подменили бы.
 * Возвращает null с текстом ошибки, если купить не вышло.
 */
export async function buyItem(itemId: string): Promise<BuyResult | { error: string }> {
  if (!backendReady() || !supabase) return { error: 'offline' }
  const { data, error } = await supabase.rpc('buy_item', { p_item_id: itemId })
  if (error) {
    netWarn('buyItem', error)
    return { error: error.message.includes('тиын') ? 'coins' : 'failed' }
  }
  const r = data as { coins: number; test_mode: boolean }
  return { coins: r.coins, testMode: r.test_mode }
}

export async function equipItem(itemId: string): Promise<EquipMap | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.rpc('equip_item', { p_item_id: itemId })
  if (error) {
    netWarn('equipItem', error)
    return null
  }
  return data as EquipMap
}

/** Тиыны за игру. Потолок и защита от накрутки — на сервере. */
export async function awardCoins(amount: number, reason: string): Promise<number | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.rpc('award_coins', {
    p_amount: amount,
    p_reason: reason,
  })
  if (error) {
    netWarn('awardCoins', error)
    return null
  }
  return data as number
}
