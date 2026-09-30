import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PHYSICS, quantize } from '@/physics'
import { Ornament } from '@/components/Ornament'
import { useT } from '@/i18n'
import { DEFAULT_CUSTOM, customUrl, saveCustomLevel, type CustomLayout } from '@/net/custom'
import { hasBackend } from '@/net/supabase'

const MAX_ASYKS = 12
/** Холст квадратный; поле занимает его с небольшим полем по краям. */
const PAD = 1.18

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-sm text-steppe-200">{label}</span>
        <b className="text-sm text-gold-400">{hint ?? value}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-11 w-full accent-gold-400"
      />
    </label>
  )
}

export function Editor() {
  const t = useT()
  const navigate = useNavigate()
  const svg = useRef<SVGSVGElement>(null)

  const [title, setTitle] = useState('')
  const [layout, setLayout] = useState<CustomLayout>(DEFAULT_CUSTOM)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const span = layout.fieldRadius * PAD
  const asykR = PHYSICS.asykRadius

  /** Экранная точка → координаты мира. */
  const toWorld = (clientX: number, clientY: number) => {
    const box = svg.current?.getBoundingClientRect()
    if (!box) return null
    const nx = (clientX - box.left) / box.width
    const ny = (clientY - box.top) / box.height
    return {
      x: quantize((nx * 2 - 1) * span),
      // ось Y мира направлена «от игрока», экранная — вниз
      y: quantize((1 - ny * 2) * span),
    }
  }

  const inside = (p: { x: number; y: number }) =>
    layout.shape === 'circle'
      ? Math.hypot(p.x, p.y) <= layout.fieldRadius - asykR
      : Math.abs(p.x) <= layout.fieldRadius - asykR && Math.abs(p.y) <= layout.fieldRadius - asykR

  const tap = (e: React.PointerEvent<SVGSVGElement>) => {
    if (saved) return
    const p = toWorld(e.clientX, e.clientY)
    if (!p) return

    // попали в существующий асык — убираем его
    const hitIndex = layout.asyks.findIndex(
      (a) => Math.hypot(a.x - p.x, a.y - p.y) < asykR * 1.6,
    )
    if (hitIndex >= 0) {
      setLayout({ ...layout, asyks: layout.asyks.filter((_, i) => i !== hitIndex) })
      return
    }

    if (layout.asyks.length >= MAX_ASYKS) return
    if (!inside(p)) return
    // не даём асыкам слипаться: иначе кон стартует с телами внутри друг друга
    if (layout.asyks.some((a) => Math.hypot(a.x - p.x, a.y - p.y) < asykR * 2.1)) return

    setLayout({ ...layout, asyks: [...layout.asyks, p] })
  }

  const goalLabel = layout.goal === 0 ? t('editor.goalAll') : String(layout.goal)
  const valid = layout.asyks.length > 0 && title.trim().length > 0
  const maxGoal = layout.asyks.length

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    const clean: CustomLayout = {
      ...layout,
      goal: Math.min(layout.goal, maxGoal),
      asyks: layout.asyks.map((a) => ({ x: quantize(a.x), y: quantize(a.y) })),
    }
    const id = await saveCustomLevel(title.trim(), clean)
    setSaving(false)
    if (id) setSaved(id)
  }

  const link = useMemo(() => (saved ? customUrl(saved) : ''), [saved])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-6">
      <Link to="/" className="self-start text-sm text-steppe-300">
        ← {t('common.menu')}
      </Link>

      <Ornament className="mx-auto my-4 h-3 w-40 text-gold-500/70" />
      <h1 className="text-center text-2xl font-extrabold text-steppe-50">{t('editor.title')}</h1>
      <p className="mt-2 text-center text-sm text-steppe-300">{t('editor.hint')}</p>

      {/* ── Холст ────────────────────────────────────────────────────────── */}
      <svg
        ref={svg}
        viewBox={`${-span} ${-span} ${span * 2} ${span * 2}`}
        onPointerDown={tap}
        className="mt-5 aspect-square w-full touch-none rounded-3xl bg-[#c4a678] ring-1 ring-white/10"
      >
        {layout.shape === 'circle' ? (
          <circle cx={0} cy={0} r={layout.fieldRadius} fill="none" stroke="#fdf8ec" strokeWidth={0.018} strokeDasharray="0.07 0.05" />
        ) : (
          <rect
            x={-layout.fieldRadius}
            y={-layout.fieldRadius}
            width={layout.fieldRadius * 2}
            height={layout.fieldRadius * 2}
            fill="none"
            stroke="#fdf8ec"
            strokeWidth={0.018}
            strokeDasharray="0.07 0.05"
          />
        )}
        {/* сақа прилетает снизу — показываем направление броска */}
        <path
          d={`M 0 ${span * 0.93} L 0 ${layout.fieldRadius * 1.02}`}
          stroke="#f2c14e"
          strokeWidth={0.02}
          strokeDasharray="0.06 0.05"
          opacity={0.75}
        />
        {layout.asyks.map((a, i) => (
          <g key={`${a.x}:${a.y}:${i}`}>
            <ellipse cx={a.x} cy={-a.y} rx={asykR} ry={asykR * 0.78} fill="#f6ead2" stroke="#6b4f2a" strokeWidth={0.012} />
            <ellipse cx={a.x} cy={-a.y - asykR * 0.22} rx={asykR * 0.48} ry={asykR * 0.3} fill="#e0cdaa" />
          </g>
        ))}
      </svg>

      <p className="mt-2 text-center text-xs text-steppe-400">
        {t('editor.count', { n: String(layout.asyks.length), max: String(MAX_ASYKS) })}
      </p>

      {/* ── Настройки ────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-col gap-4 rounded-3xl bg-night-800 p-5 ring-1 ring-white/10">
        <div className="flex gap-2">
          {(['circle', 'square'] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              onClick={() => setLayout({ ...layout, shape })}
              className={`min-h-[44px] flex-1 rounded-2xl text-sm font-bold ${
                layout.shape === shape
                  ? 'bg-gold-400 text-night-900'
                  : 'bg-white/10 text-steppe-100 ring-1 ring-white/15'
              }`}
            >
              {t(shape === 'circle' ? 'editor.circle' : 'editor.square')}
            </button>
          ))}
        </div>

        <Slider
          label={t('editor.fieldRadius')}
          value={layout.fieldRadius}
          min={0.6}
          max={1.4}
          step={0.01}
          hint={`${layout.fieldRadius.toFixed(2)} м`}
          onChange={(v) => setLayout({ ...layout, fieldRadius: v })}
        />
        <Slider
          label={t('editor.throws')}
          value={layout.throws}
          min={1}
          max={8}
          step={1}
          onChange={(v) => setLayout({ ...layout, throws: v })}
        />
        <Slider
          label={t('editor.goal')}
          value={Math.min(layout.goal, maxGoal)}
          min={0}
          max={Math.max(maxGoal, 1)}
          step={1}
          hint={goalLabel}
          onChange={(v) => setLayout({ ...layout, goal: v })}
        />

        <label className="flex min-h-[44px] items-center justify-between gap-3">
          <span className="text-sm text-steppe-200">{t('editor.penalty')}</span>
          <input
            type="checkbox"
            checked={layout.penalty}
            onChange={(e) => setLayout({ ...layout, penalty: e.target.checked })}
            className="h-6 w-6 accent-gold-400"
          />
        </label>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 60))}
          placeholder={t('editor.name')}
          className="min-h-[48px] w-full rounded-2xl bg-white/10 px-4 text-steppe-50 ring-1 ring-white/15 placeholder:text-steppe-400"
        />
      </div>

      {/* ── Сохранение ───────────────────────────────────────────────────── */}
      {!hasBackend && (
        <p className="mt-4 rounded-2xl bg-white/5 p-4 text-center text-sm text-steppe-300">
          {t('editor.offline')}
        </p>
      )}

      {saved ? (
        <div className="mt-5 rounded-3xl bg-night-800 p-5 text-center ring-1 ring-gold-400/30">
          <p className="text-sm font-bold text-gold-400">{t('editor.saved')}</p>
          <p className="mt-2 break-all text-xs text-steppe-300">{link}</p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard?.writeText(link)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              }}
              className="min-h-[44px] flex-1 rounded-2xl bg-white/10 text-sm font-bold text-steppe-50 ring-1 ring-white/15"
            >
              {copied ? t('online.copied') : t('online.copy')}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/c/${saved}`)}
              className="min-h-[44px] flex-1 rounded-2xl bg-gold-400 text-sm font-bold text-night-900"
            >
              {t('common.play')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!valid || saving || !hasBackend}
          onClick={save}
          className="mt-5 min-h-[52px] w-full rounded-2xl bg-gold-400 text-lg font-bold text-night-900 transition-transform active:scale-95 disabled:opacity-40"
        >
          {saving ? t('common.loading') : t('editor.save')}
        </button>
      )}

      <Link to="/custom" className="mt-4 text-center text-sm text-steppe-300">
        {t('editor.feedLink')} →
      </Link>
    </div>
  )
}
