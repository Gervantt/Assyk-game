import { useAimStore } from '@/store/useAimStore'
import { useT } from '@/i18n'

/** Зелёный → жёлтый → красный. */
export function powerColor(p: number): string {
  const hue = 122 - 122 * Math.min(Math.max(p, 0), 1)
  return `hsl(${hue} 82% 52%)`
}

export function PowerBar() {
  const t = useT()
  const power = useAimStore((s) => s.power)
  const active = useAimStore((s) => s.active)

  return (
    <div
      className="pointer-events-none flex items-center gap-2 transition-opacity duration-150"
      style={{ opacity: active ? 1 : 0.28 }}
    >
      <span className="text-[11px] uppercase tracking-widest text-steppe-300">{t('hud.power')}</span>
      <div className="h-2.5 w-32 overflow-hidden rounded-full bg-black/45 ring-1 ring-white/15 sm:w-44">
        <div
          className="h-full rounded-full transition-[width] duration-75"
          style={{ width: `${power * 100}%`, backgroundColor: powerColor(power) }}
        />
      </div>
      <span className="w-9 text-right font-mono text-xs text-steppe-100">
        {Math.round(power * 100)}
      </span>
    </div>
  )
}
