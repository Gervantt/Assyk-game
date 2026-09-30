import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ornament } from '@/components/Ornament'
import { useT } from '@/i18n'
import { ONLINE_MAPS, type OnlineMap } from '@/game/maps'
import { listCustomLevels, type CustomLevelRow } from '@/net/custom'
import { useAuthStore } from '@/store/useAuthStore'
import { useMatchStore } from '@/store/useMatchStore'

/** Миниатюра кона: видно, во что играешь, до создания матча. */
function Preview({
  shape,
  radius,
  points,
  stones,
}: {
  shape: 'circle' | 'square'
  radius: number
  points: Array<{ x: number; y: number }>
  stones: Array<{ x: number; y: number; radius: number }>
}) {
  const span = Math.max(radius * 1.25, 1.5)
  return (
    <svg
      viewBox={`${-span} ${-span} ${span * 2} ${span * 2}`}
      className="h-16 w-16 shrink-0 rounded-xl bg-[#c4a678]"
      aria-hidden
    >
      {shape === 'square' ? (
        <rect x={-radius} y={-radius} width={radius * 2} height={radius * 2} fill="none" stroke="#fdf8ec" strokeWidth={0.05} />
      ) : (
        <circle cx={0} cy={0} r={radius} fill="none" stroke="#fdf8ec" strokeWidth={0.05} />
      )}
      {stones.map((s, i) => (
        <circle key={`s${i}`} cx={s.x} cy={-s.y} r={s.radius} fill="#5f574a" />
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={-p.y} r={0.075} fill="#f6ead2" />
      ))}
    </svg>
  )
}

/** Позиции асыков готовой карты — только для миниатюры. */
function previewPoints(map: OnlineMap): Array<{ x: number; y: number }> {
  const { kind, count, fieldRadius } = map.layout
  const gap = 0.255
  const out: Array<{ x: number; y: number }> = []
  if (kind === 'circle') {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count
      out.push({ x: Math.cos(a) * fieldRadius * 0.55, y: Math.sin(a) * fieldRadius * 0.55 })
    }
  } else if (kind === 'pyramid') {
    let row = 0
    let placed = 0
    while (placed < count) {
      const inRow = Math.min(row + 1, count - placed)
      const start = -((inRow - 1) * gap) / 2
      for (let i = 0; i < inRow; i++) out.push({ x: start + i * gap, y: row * gap * 0.88 })
      placed += inRow
      row++
    }
  } else {
    const start = -((count - 1) * gap) / 2
    for (let i = 0; i < count; i++) out.push({ x: start + i * gap, y: 0 })
  }
  return out
}

export function NewMatch() {
  const t = useT()
  const navigate = useNavigate()
  const host = useMatchStore((s) => s.host)
  const userId = useAuthStore((s) => s.profile?.id ?? null)

  const [picked, setPicked] = useState<string>(ONLINE_MAPS[0]!.id)
  const [mine, setMine] = useState<CustomLevelRow[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void listCustomLevels('mine', userId).then((r) => {
      if (!cancelled) setMine(r)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const create = async () => {
    if (busy) return
    setBusy(true)
    const own = mine.find((m) => `custom:${m.id}` === picked)
    const id = own
      ? await host(undefined, {
          layout: {
            kind: 'custom',
            count: own.layout.asyks.length,
            fieldRadius: own.layout.fieldRadius,
            shape: own.layout.shape,
            positions: own.layout.asyks,
          },
          stones: own.layout.stones,
          relief: own.layout.relief,
          throwsPerPlayer: Math.max(3, own.layout.throws),
          sakaInFieldPenalty: own.layout.penalty,
          mapId: `custom:${own.id}`,
        })
      : await host(picked)
    setBusy(false)
    if (id) navigate(`/m/${id}`)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-6">
      <Link to="/" className="self-start text-sm text-steppe-300">
        ← {t('common.menu')}
      </Link>

      <Ornament className="mx-auto my-4 h-3 w-40 text-gold-500/70" />
      <h1 className="text-center text-2xl font-extrabold text-steppe-50">{t('online.pickMap')}</h1>
      <p className="mt-2 text-center text-sm text-steppe-300">{t('online.pickMap.d')}</p>

      <ul className="mt-5 flex flex-col gap-2">
        {ONLINE_MAPS.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => setPicked(m.id)}
              aria-pressed={picked === m.id}
              className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 ${
                picked === m.id ? 'bg-gold-400/10 ring-gold-400/50' : 'bg-night-800 ring-white/10'
              }`}
            >
              <Preview
                shape={(m.layout.shape ?? 'circle') as 'circle' | 'square'}
                radius={m.layout.fieldRadius}
                points={previewPoints(m)}
                stones={m.stones ?? []}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-steppe-50">{t(m.title)}</span>
                <span className="block text-[11px] leading-snug text-steppe-400">{t(m.desc)}</span>
              </span>
            </button>
          </li>
        ))}

        {mine.length > 0 && (
          <li className="mt-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gold-400">
              {t('online.myChallenge')}
            </p>
            <p className="mt-1 text-[11px] text-steppe-400">{t('online.myChallenge.d')}</p>
          </li>
        )}
        {mine.map((m) => {
          const id = `custom:${m.id}`
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setPicked(id)}
                aria-pressed={picked === id}
                className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 ${
                  picked === id ? 'bg-gold-400/10 ring-gold-400/50' : 'bg-night-800 ring-white/10'
                }`}
              >
                <Preview
                  shape={m.layout.shape}
                  radius={m.layout.fieldRadius}
                  points={m.layout.asyks}
                  stones={m.layout.stones ?? []}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-steppe-50">{m.title}</span>
                  <span className="block text-[11px] text-steppe-400">
                    {t('custom.throws', { n: String(m.layout.throws) })}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <Link to="/editor" className="mt-4 text-center text-sm text-steppe-300">
        {t('custom.create')} →
      </Link>

      <button
        type="button"
        disabled={busy}
        onClick={() => void create()}
        className="mt-5 min-h-[52px] w-full rounded-2xl bg-gold-400 text-lg font-bold text-night-900 transition-transform active:scale-95 disabled:opacity-40"
      >
        {busy ? t('common.loading') : t('online.createMatch')}
      </button>
    </div>
  )
}
