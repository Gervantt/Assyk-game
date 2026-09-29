import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * Клиент Supabase. Может быть null: без переменных окружения игра
 * обязана работать полностью офлайн, поэтому здесь нет throw.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null

export const hasBackend = supabase !== null

/**
 * Если облако заведомо недоступно (не включён гостевой вход, не применены
 * миграции), дальнейшие запросы бессмысленны: они только засоряют консоль
 * и тратят время. Один раз выключаем и играем локально до перезагрузки.
 */
let disabled = false

export function disableBackend(reason: string): void {
  if (disabled) return
  disabled = true
  console.info(`[net] облако отключено: ${reason}. Игра работает локально.`)
}

export function backendReady(): boolean {
  return supabase !== null && !disabled
}

/** Единая точка логирования сетевых сбоев: наверх они не пробрасываются. */
export function netWarn(where: string, error: unknown): void {
  if (!error) return
  console.warn(`[net] ${where}:`, error)
}
