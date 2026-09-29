/** Строки таблиц. Пишутся руками: генератор типов требует доступа к проекту. */

export interface University {
  id: string
  name: string
  city: string
  sort: number
}

export interface Profile {
  id: string
  username: string
  avatar: string
  university_id: string | null
  locale: string
  rating: number
  coins: number
  is_guest: boolean
  created_at: string
  updated_at: string
}

export interface ProgressRow {
  user_id: string
  level_id: string
  stars: number
  best_throws: number
  updated_at: string
}

export type ResultMode = 'training' | 'hotseat' | 'campaign' | 'tutorial' | 'daily'

export interface ResultRow {
  id: string
  user_id: string
  mode: ResultMode
  level_id: string | null
  score: number
  throws: number
  accuracy: number
  stars: number | null
  created_at: string
}

export interface DailyRow {
  user_id: string
  date: string
  score: number
  throws: number
  accuracy: number
  created_at: string
}

export interface LeaderboardRow {
  user_id: string
  username: string
  avatar: string
  university: string | null
  score: number
  throws: number
  accuracy: number
  rank: number
}

/** Состояние подключения — им объясняется, почему прогресс не улетает в облако. */
export type BackendStatus =
  | 'offline'   // переменных окружения нет — играем локально
  | 'connecting'
  | 'ready'
  | 'anon-disabled' // анонимный вход выключен в проекте
  | 'no-tables'     // миграции ещё не применены
  | 'error'
