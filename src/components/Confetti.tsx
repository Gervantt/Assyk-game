import { useEffect, useRef } from 'react'
import { mulberry32 } from '@/physics'
import { useSettings } from '@/store/useSettings'

/** Цвета флага Казахстана. */
const COLORS = ['#00AFCA', '#FEC50C', '#7fd6e6', '#ffe08a']

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  spin: number
  color: string
}

/** Конфетти в цветах флага на экране победы. */
export function Confetti({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const effects = useSettings((s) => s.effects)

  useEffect(() => {
    if (!active || effects === 'reduced') return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const rnd = mulberry32(0x5eed)
    const pieces: Piece[] = Array.from({ length: 110 }, () => ({
      x: rnd() * w,
      y: -rnd() * h * 0.7,
      vx: (rnd() - 0.5) * 70,
      vy: 90 + rnd() * 160,
      w: 5 + rnd() * 7,
      h: 8 + rnd() * 10,
      rot: rnd() * Math.PI,
      spin: (rnd() - 0.5) * 7,
      color: COLORS[Math.floor(rnd() * COLORS.length)]!,
    }))

    let raf = 0
    let prev = performance.now()
    let elapsed = 0

    const tick = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05)
      prev = now
      elapsed += dt
      ctx.clearRect(0, 0, w, h)

      for (const p of pieces) {
        p.vy += 110 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.spin * dt
        if (p.y > h + 20) {
          p.y = -20
          p.x = rnd() * w
          p.vy = 90 + rnd() * 120
        }
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 7)
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (elapsed < 7) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, w, h)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, effects])

  if (!active || effects === 'reduced') return null
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-30 h-full w-full" />
}
