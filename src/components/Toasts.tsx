import { useEffect } from 'react'
import { useT } from '@/i18n'
import { useGameStore } from '@/store/useGameStore'

const TONE = {
  good: 'text-gold-400',
  bad: 'text-steppe-300',
  combo: 'text-sky-450',
} as const

/** Всплывающие подписи о результате броска. */
export function Toasts() {
  const t = useT()
  const toasts = useGameStore((s) => s.toasts)
  const dismiss = useGameStore((s) => s.dismissToast)

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map((x) => window.setTimeout(() => dismiss(x.id), 1800))
    return () => timers.forEach(clearTimeout)
  }, [toasts, dismiss])

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 flex flex-col items-center gap-1">
      {toasts.map((x) => (
        <div
          key={x.id}
          className={`animate-pop text-center text-2xl font-extrabold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-4xl ${TONE[x.tone]}`}
        >
          {t(x.key)}
        </div>
      ))}
    </div>
  )
}
