import { useT } from '@/i18n'
import type { DictKey } from '@/i18n'
import { useAuthStore } from '@/store/useAuthStore'
import type { BackendStatus } from '@/net/types'

const MESSAGE: Partial<Record<BackendStatus, DictKey>> = {
  offline: 'net.offline',
  'anon-disabled': 'net.anonDisabled',
  'no-tables': 'net.noTables',
  error: 'net.error',
}

/** Объясняет, почему прогресс не уходит в облако. Игру при этом не блокирует. */
export function BackendBanner() {
  const t = useT()
  const status = useAuthStore((s) => s.status)
  const key = MESSAGE[status]
  if (!key) return null

  return (
    <p className="rounded-2xl bg-sky-550/15 px-4 py-2.5 text-center text-xs leading-relaxed text-sky-450 ring-1 ring-sky-450/25">
      {t(key)}
    </p>
  )
}
