import { netWarn, supabase } from './supabase'
import type { BackendStatus } from './types'

/**
 * Гостевой вход. Играть надо сразу, поэтому:
 * — если анонимный вход выключен в проекте, это не ошибка, а режим офлайн;
 * — ни одна ветка не бросает исключение наверх.
 */
export async function ensureGuestSession(): Promise<BackendStatus> {
  if (!supabase) return 'offline'

  const { data: existing } = await supabase.auth.getSession()
  if (existing.session) return 'ready'

  const { error } = await supabase.auth.signInAnonymously()
  if (!error) return 'ready'

  netWarn('signInAnonymously', error)
  const code = (error as { code?: string }).code ?? ''
  if (code.includes('anonymous_provider_disabled')) return 'anon-disabled'
  return 'error'
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export async function isGuest(): Promise<boolean> {
  if (!supabase) return true
  const { data } = await supabase.auth.getUser()
  return data.user?.is_anonymous ?? true
}

export interface UpgradeResult {
  ok: boolean
  /** письмо отправлено — ждём подтверждения по ссылке */
  pendingEmail?: boolean
  message?: string
}

/**
 * Сохранение прогресса через почту. Для анонимного пользователя это
 * updateUser: идентификатор НЕ меняется, поэтому прогресс переносится сам.
 * Если почта уже занята другим аккаунтом, уходим на обычный вход по ссылке,
 * а локальный прогресс потом дольётся через save_progress.
 */
export async function upgradeWithEmail(email: string): Promise<UpgradeResult> {
  if (!supabase) return { ok: false, message: 'offline' }

  const { error } = await supabase.auth.updateUser({ email })
  if (!error) return { ok: true, pendingEmail: true }

  netWarn('updateUser(email)', error)
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/profile` },
  })
  if (otpError) {
    netWarn('signInWithOtp', otpError)
    return { ok: false, message: otpError.message }
  }
  return { ok: true, pendingEmail: true }
}

/**
 * Сохранение прогресса через Google. linkIdentity привязывает Google
 * к текущему гостю и сохраняет тот же идентификатор.
 */
export async function upgradeWithGoogle(): Promise<UpgradeResult> {
  if (!supabase) return { ok: false, message: 'offline' }
  const redirectTo = `${window.location.origin}/profile`

  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo },
  })
  if (!error) return { ok: true }

  netWarn('linkIdentity(google)', error)
  const { error: signInError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (signInError) {
    netWarn('signInWithOAuth(google)', signInError)
    return { ok: false, message: signInError.message }
  }
  return { ok: true }
}

/** Вход существующего аккаунта по паролю — им пользуются проверяющие. */
export async function signInWithPassword(email: string, password: string): Promise<UpgradeResult> {
  if (!supabase) return { ok: false, message: 'offline' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    netWarn('signInWithPassword', error)
    return { ok: false, message: error.message }
  }
  return { ok: true }
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  netWarn('signOut', error)
}
