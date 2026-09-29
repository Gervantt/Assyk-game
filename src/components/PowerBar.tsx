import { useAimStore } from '@/store/useAimStore'
import { useT } from '@/i18n'

/** Зелёный → жёлтый → красный. */
export function powerColor(p: number): string {
  const hue = 122 - 122 * Math.min(Math.max(p, 0), 1)
  return `hsl(${hue} 82% 52%)`
}

/** zone — подсвеченный диапазон силы, нужен в обучении. */
export function PowerBar({ zone }: { zone?: [number, number] }) {
  const t = useT()
  const power = useAimStore((s) => s.power)
  const active = useAimStore((s) => s.active)
  const elevation = useAimStore((s) => s.elevation)

  return (
    <div
      className="pointer-events-none flex items-center gap-2 transition-opacity duration-150"
      style={{ opacity: active ? 1 : 0.28 }}
    >
      <span className="text-[11px] uppercase tracking-widest text-steppe-300">{t('hud.power')}</span>
      <div className="relative h-2.5 w-32 overflow-hidden rounded-full bg-black/45 ring-1 ring-white/15 sm:w-44">
        {zone && (
          <div
            className="absolute inset-y-0 bg-white/25 ring-1 ring-inset ring-white/40"
            style={{ left: `${zone[0] * 100}%`, width: `${(zone[1] - zone[0]) * 100}%` }}
          />
        )}
        <div
          className="relative h-full rounded-full transition-[width] duration-75"
          style={{ width: `${power * 100}%`, backgroundColor: powerColor(power) }}
        />
      </div>
      <span className="w-9 text-right font-mono text-xs text-steppe-100">
        {Math.round(power * 100)}
      </span>
      <span className="ml-1 w-12 text-right font-mono text-xs text-sky-450">
        {Math.round((elevation * 180) / Math.PI)}°
      </span>
    </div>
  )
}
