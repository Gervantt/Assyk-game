import { backendReady, netWarn, supabase } from './supabase'
import type { Profile, University } from './types'

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) {
    netWarn('fetchProfile', error)
    return null
  }
  return data as Profile | null
}

/**
 * Профиль обычно создаётся триггером вместе с пользователем.
 * Этот upsert — страховка на случай, если миграция с триггером ещё не применена.
 */
export async function ensureProfile(userId: string, username: string, locale: string) {
  if (!backendReady() || !supabase) return null
  const existing = await fetchProfile(userId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, username, locale }, { onConflict: 'id' })
    .select()
    .maybeSingle()
  if (error) {
    netWarn('ensureProfile', error)
    return null
  }
  return data as Profile | null
}

export type ProfilePatch = Partial<Pick<Profile, 'username' | 'avatar' | 'university_id' | 'locale'>>

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<Profile | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .maybeSingle()
  if (error) {
    netWarn('updateProfile', error)
    return null
  }
  return data as Profile | null
}

export async function fetchUniversities(): Promise<University[]> {
  if (!backendReady() || !supabase) return []
  const { data, error } = await supabase
    .from('universities')
    .select('*')
    .order('sort', { ascending: true })
  if (error) {
    netWarn('fetchUniversities', error)
    return []
  }
  return (data ?? []) as University[]
}

/** Аватары — набор эмодзи: не нужен ни бакет, ни загрузка файлов. */
export const AVATARS = ['saka', 'asyk', 'eagle', 'yurt', 'horse', 'dombra', 'star', 'sun'] as const
export type AvatarKey = (typeof AVATARS)[number]

export const AVATAR_EMOJI: Record<string, string> = {
  saka: '🔴',
  asyk: '🦴',
  eagle: '🦅',
  yurt: '⛺',
  horse: '🐎',
  dombra: '🪕',
  star: '⭐',
  sun: '☀️',
}
