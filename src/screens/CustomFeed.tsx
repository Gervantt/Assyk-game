import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ornament } from '@/components/Ornament'
import { useT } from '@/i18n'
import {
  likeCustomLevel,
  listCustomLevels,
  type CustomLevelRow,
  type CustomSort,
} from '@/net/custom'
import { hasBackend } from '@/net/supabase'
import { useAuthStore } from '@/store/useAuthStore'

const TABS: CustomSort[] = ['popular', 'new', 'mine']

/** Миниатюра раскладки — по ней видно, во что играешь, ещё до запуска. */
function Preview({ level }: { level: CustomLevelRow }) {
  const r = level.layout?.fieldRadius ?? 0.93
  const span = r * 1.2
  return (
    <svg
      viewBox={`${-span} ${-span} ${span * 2} ${span * 2}`}
      className="h-14 w-14 shrink-0 rounded-xl bg-[#c4a678]"
      aria-hidden
    >
      {level.layout?.shape === 'square' ? (
        <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="none" stroke="#fdf8ec" strokeWidth={0.04} />
      ) : (
        <circle cx={0} cy={0} r={r} fill="none" stroke="#fdf8ec" strokeWidth={0.04} />
      )}
      {(level.layout?.asyks ?? []).map((a, i) => (
        <circle key={i} cx={a.x} cy={-a.y} r={0.075} fill="#f6ead2" />
      ))}
    </svg>
  )
}

export function CustomFeed() {
  const t = useT()
  const userId = useAuthStore((s) => s.profile?.id ?? null)
  const [sort, setSort] = useState<CustomSort>('popular')
  const [rows, setRows] = useState<CustomLevelRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    void listCustomLevels(sort, userId).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [sort, userId])

  const toggleLike = async (id: string) => {
    // отзываемся сразу, не дожидаясь сервера: иначе лайк ощущается «залипшим»
    setRows(
      (prev) =>
        prev?.map((r) =>
          r.id === id ? { ...r, liked: !r.liked, likes: r.likes + (r.liked ? -1 : 1) } : r,
        ) ?? prev,
    )
    const total = await likeCustomLevel(id)
    if (total === null) return
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, likes: total } : r)) ?? prev)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-6">
      <Link to="/" className="self-start text-sm text-steppe-300">
        ← {t('common.menu')}
      </Link>

      <Ornament className="mx-auto my-4 h-3 w-40 text-gold-500/70" />
      <h1 className="text-center text-2xl font-extrabold text-steppe-50">{t('custom.title')}</h1>

      <Link
        to="/editor"
        className="mt-5 flex min-h-[52px] items-center justify-center rounded-2xl bg-gold-400 text-lg font-bold text-night-900 transition-transform active:scale-95"
      >
        {t('custom.create')}
      </Link>

      <div className="mt-5 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSort(tab)}
            className={`min-h-[44px] flex-1 rounded-xl text-sm font-bold ${
              sort === tab
                ? 'bg-white/15 text-steppe-50 ring-1 ring-gold-400/40'
                : 'bg-white/5 text-steppe-300'
            }`}
          >
            {t(`custom.${tab}` as 'custom.popular')}
          </button>
        ))}
      </div>

      {!hasBackend && (
        <p className="mt-6 rounded-2xl bg-white/5 p-4 text-center text-sm text-steppe-300">
          {t('custom.offline')}
        </p>
      )}
      {hasBackend && rows === null && (
        <p className="mt-6 text-center text-sm text-steppe-300">{t('common.loading')}</p>
      )}
      {hasBackend && rows?.length === 0 && (
        <p className="mt-6 rounded-2xl bg-white/5 p-4 text-center text-sm text-steppe-300">
          {t('common.empty')}
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {(rows ?? []).map((level) => (
          <li
            key={level.id}
            className="flex items-center gap-3 rounded-2xl bg-night-800 p-3 ring-1 ring-white/10"
          >
            <Preview level={level} />
            <Link to={`/c/${level.id}`} className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-steppe-50">{level.title}</span>
              <span className="block truncate text-[11px] text-steppe-400">
                {level.author} · {t('custom.plays', { n: String(level.plays) })} ·{' '}
                {t('custom.throws', { n: String(level.layout?.throws ?? 0) })}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void toggleLike(level.id)}
              aria-pressed={level.liked}
              className={`flex min-h-[44px] min-w-[52px] flex-col items-center justify-center rounded-xl text-xs ${
                level.liked ? 'bg-gold-400/20 text-gold-400' : 'bg-white/5 text-steppe-300'
              }`}
            >
              <span aria-hidden>{level.liked ? '♥' : '♡'}</span>
              {level.likes}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
