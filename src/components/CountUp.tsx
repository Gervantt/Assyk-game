import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from '@/store/useSettings'

/** Число, которое «тикает» вверх до значения. Уважает prefers-reduced-motion. */
export function CountUp({
  value,
  duration = 700,
  delay = 0,
  className = '',
}: {
  value: number
  duration?: number
  delay?: number
  className?: string
}) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0)
  const raf = useRef(0)

  useEffect(() => {
    if (reducedMotion()) {
      setShown(value)
      return
    }
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const t = Math.min(1, (now - start - delay) / duration)
      if (t < 0) {
        raf.current = requestAnimationFrame(tick)
        return
      }
      // замедление к концу: число «доезжает», а не обрывается
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration, delay])

  return <span className={className}>{shown}</span>
}
