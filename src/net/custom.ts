import { currentUserId } from './auth'
import { backendReady, netWarn, supabase } from './supabase'

/** Раскладка пользовательского испытания. Хранится в custom_levels.layout. */
export interface CustomLayout {
  /** версия формата: пригодится, когда редактор обрастёт новыми полями */
  v: 1
  asyks: Array<{ x: number; y: number }>
  shape: 'circle' | 'square'
  fieldRadius: number
  throws: number
  /** сколько асыков надо выбить; 0 — выбить все */
  goal: number
  penalty: boolean
  surface: string
}

export interface CustomLevelRow {
  id: string
  title: string
  layout: CustomLayout
  plays: number
  likes: number
  created_at: string
  author_id: string
  author: string
  liked: boolean
}

export type CustomSort = 'popular' | 'new' | 'mine'

export const DEFAULT_CUSTOM: CustomLayout = {
  v: 1,
  asyks: [],
  shape: 'circle',
  fieldRadius: 0.93,
  throws: 3,
  goal: 0,
  penalty: true,
  surface: 'sand',
}

export async function saveCustomLevel(
  title: string,
  layout: CustomLayout,
): Promise<string | null> {
  if (!backendReady() || !supabase) return null
  // author_id обязателен: политика custom_levels_insert_own проверяет
  // author_id = auth.uid(), и без него вставка отлетает с 403.
  const author = await currentUserId()
  if (!author) return null
  const { data, error } = await supabase
    .from('custom_levels')
    .insert({ title, layout, author_id: author })
    .select('id')
    .single()
  if (error) {
    netWarn('saveCustomLevel', error)
    return null
  }
  return (data as { id: string }).id
}

export async function fetchCustomLevel(id: string): Promise<CustomLevelRow | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase
    .from('custom_levels')
    .select('id, title, layout, plays, likes, created_at, author_id')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    netWarn('fetchCustomLevel', error)
    return null
  }
  if (!data) return null
  return { ...(data as object), author: '—', liked: false } as CustomLevelRow
}

export async function listCustomLevels(
  sort: CustomSort,
  myId: string | null,
): Promise<CustomLevelRow[]> {
  if (!backendReady() || !supabase) return []
  const { data, error } = await supabase.rpc('list_custom_levels', {
    p_sort: sort,
    p_limit: 40,
  })
  if (error) {
    netWarn('listCustomLevels', error)
    return []
  }
  const rows = (data as CustomLevelRow[]) ?? []
  return sort === 'mine' ? rows.filter((r) => r.author_id === myId) : rows
}

export async function likeCustomLevel(id: string): Promise<number | null> {
  if (!backendReady() || !supabase) return null
  const { data, error } = await supabase.rpc('like_custom_level', { p_level_id: id })
  if (error) {
    netWarn('likeCustomLevel', error)
    return null
  }
  return data as number
}

export async function bumpPlays(id: string): Promise<void> {
  if (!backendReady() || !supabase) return
  const { error } = await supabase.rpc('bump_custom_plays', { p_level_id: id })
  if (error) netWarn('bumpPlays', error)
}

/** Ссылка на испытание — ей делятся и по ней открывают. */
export function customUrl(id: string): string {
  return `${window.location.origin}/c/${id}`
}
