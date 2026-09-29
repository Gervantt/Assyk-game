import { create } from 'zustand'
import { ensureGuestSession, currentUserId, signOut as netSignOut } from '@/net/auth'
import { ensureProfile, fetchProfile, fetchUniversities, updateProfile, type ProfilePatch } from '@/net/profile'
import { syncProgress } from '@/net/sync'
import { disableBackend, supabase } from '@/net/supabase'
import type { BackendStatus, Profile, University } from '@/net/types'
import { useI18n } from '@/i18n'

interface AuthStore {
  status: BackendStatus
  userId: string | null
  profile: Profile | null
  universities: University[]
  /** идёт обмен прогрессом */
  syncing: boolean

  init: () => Promise<void>
  reload: () => Promise<void>
  save: (patch: ProfilePatch) => Promise<boolean>
  signOut: () => Promise<void>
}

function guestName(): string {
  const n = Math.floor(Math.random() * 9000) + 1000
  return `Қонақ ${n}`
}

let subscribed = false

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: 'connecting',
  userId: null,
  profile: null,
  universities: [],
  syncing: false,

  init: async () => {
    const status = await ensureGuestSession()
    if (status !== 'ready') {
      disableBackend(status)
      set({ status, userId: null, profile: null })
      return
    }

    // сессия появилась — дальше профиль и обмен прогрессом
    if (!subscribed && supabase) {
      subscribed = true
      supabase.auth.onAuthStateChange(() => {
        void get().reload()
      })
    }
    await get().reload()
  },

  reload: async () => {
    const userId = await currentUserId()
    if (!userId) {
      set({ userId: null, profile: null })
      return
    }

    const locale = useI18n.getState().locale
    let profile = await fetchProfile(userId)
    if (!profile) profile = await ensureProfile(userId, guestName(), locale)

    // профиль не создался -> таблиц ещё нет, миграции не применены
    if (!profile) {
      disableBackend('no-tables')
      set({ status: 'no-tables', userId })
      return
    }

    set({ status: 'ready', userId, profile, syncing: true })

    const [universities] = await Promise.all([fetchUniversities(), syncProgress(userId)])
    set({ universities, syncing: false })
  },

  save: async (patch) => {
    const userId = get().userId
    if (!userId) return false
    const updated = await updateProfile(userId, patch)
    if (!updated) return false
    set({ profile: updated })
    return true
  },

  signOut: async () => {
    await netSignOut()
    set({ userId: null, profile: null })
    await get().init()
  },
}))

/** Идентификатор для фоновой записи результатов; null — играем офлайн. */
export function activeUserId(): string | null {
  const s = useAuthStore.getState()
  return s.status === 'ready' ? s.userId : null
}
