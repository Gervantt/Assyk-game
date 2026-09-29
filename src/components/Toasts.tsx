import { useEffect } from 'react'
import { useT } from '@/i18n'
import { useGameStore } from '@/store/useGameStore'

const TONE = {
  good: 'animate-pop text-3xl text-gold-400 sm:text-4xl',
  bad: 'animate-pop text-2xl text-steppe-300 sm:text-3xl',
  combo: 'animate-slam text-5xl text-sky-450 sm:text-7xl',
} as const

/** Всплывающие подписи о результате броска. */
export function Toasts() {
  const t = useT()
  const toasts = useGameStore((s) => s.toasts)
  const dismiss = useGameStore((s) => s.dismissToast)

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map((x) => window.setTimeout(() => dismiss(x.id), 2000))
    return () => timers.forEach(clearTimeout)
  }, [toasts, dismiss])

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[15%] flex flex-col items-center gap-1 px-4">
      {toasts.map((x) => (
        <div
          key={x.id}
          className={`text-center font-extrabold uppercase tracking-tight drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)] ${TONE[x.tone]}`}
        >
          {t(x.key)}
        </div>
      ))}
    </div>
  )
}
