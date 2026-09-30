import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ornament } from '@/components/Ornament'
import { useT } from '@/i18n'
import { createTournament, myTournaments, type TournamentRow } from '@/net/tournaments'
import { hasBackend } from '@/net/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { useShopStore } from '@/store/useShopStore'

const TOOL = 'tool.tournament'

export function Tournaments() {
  const t = useT()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.profile?.id ?? null)
  const owned = useShopStore((s) => s.owned)
  const loadShop = useShopStore((s) => s.load)

  const [rows, setRows] = useState<TournamentRow[] | null>(null)
  const [title, setTitle] = useState('')
  const [size, setSize] = useState<4 | 8>(4)
  const [penalty, setPenalty] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void loadShop()
  }, [loadShop, userId])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void myTournaments(userId).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const unlocked = owned.has(TOOL)

  const create = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    const row = await createTournament(title.trim(), size, {
      throwsPerPlayer: 5,
      sakaInFieldPenalty: penalty,
    })
    setBusy(false)
    if (row) navigate(`/t/${row.id}`)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-6">
      <Link to="/" className="self-start text-sm text-steppe-300">
        ← {t('common.menu')}
      </Link>

      <Ornament className="mx-auto my-4 h-3 w-40 text-gold-500/70" />
      <h1 className="text-center text-2xl font-extrabold text-steppe-50">{t('tour.title')}</h1>
      <p className="mt-2 text-center text-sm text-steppe-300">{t('tour.subtitle')}</p>

      {!hasBackend && (
        <p className="mt-6 rounded-2xl bg-white/5 p-4 text-center text-sm text-steppe-300">
          {t('tour.offline')}
        </p>
      )}

      {hasBackend && !unlocked && (
        <div className="mt-5 rounded-3xl bg-gold-400/10 p-5 text-center ring-1 ring-gold-400/30">
          <p className="text-sm font-bold text-gold-400">{t('tour.locked')}</p>
          <p className="mt-1 text-xs text-steppe-300">{t('tour.locked.d')}</p>
          <Link
            to="/shop"
            className="mt-4 flex min-h-[44px] items-center justify-center rounded-2xl bg-gold-400 font-bold text-night-900"
          >
            {t('pro.toShop')}
          </Link>
        </div>
      )}

      {hasBackend && unlocked && (
        <div className="mt-5 flex flex-col gap-4 rounded-3xl bg-night-800 p-5 ring-1 ring-white/10">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 60))}
            placeholder={t('tour.name')}
            className="min-h-[48px] rounded-2xl bg-white/10 px-4 text-steppe-50 ring-1 ring-white/15 placeholder:text-steppe-400"
          />
          <div className="flex gap-2">
            {([4, 8] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSize(n)}
                className={`min-h-[44px] flex-1 rounded-2xl text-sm font-bold ${
                  size === n ? 'bg-gold-400 text-night-900' : 'bg-white/10 text-steppe-100 ring-1 ring-white/15'
                }`}
              >
                {t('tour.players', { n: String(n) })}
              </button>
            ))}
          </div>
          <label className="flex min-h-[44px] items-center justify-between gap-3">
            <span className="text-sm text-steppe-200">{t('editor.penalty')}</span>
            <input
              type="checkbox"
              checked={penalty}
              onChange={(e) => setPenalty(e.target.checked)}
              className="h-6 w-6 accent-gold-400"
            />
          </label>
          <button
            type="button"
            disabled={!title.trim() || busy}
            onClick={() => void create()}
            className="min-h-[48px] rounded-2xl bg-gold-400 font-bold text-night-900 disabled:opacity-40"
          >
            {busy ? t('common.loading') : t('tour.create')}
          </button>
        </div>
      )}

      <h2 className="mt-7 text-xs font-bold uppercase tracking-widest text-gold-400">
        {t('tour.mine')}
      </h2>
      {rows === null ? (
        <p className="mt-3 text-center text-sm text-steppe-300">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-white/5 p-4 text-center text-sm text-steppe-300">
          {t('common.empty')}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                to={`/t/${row.id}`}
                className="flex items-center justify-between rounded-2xl bg-night-800 p-4 ring-1 ring-white/10"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-steppe-50">{row.title}</span>
                  <span className="text-[11px] text-steppe-400">
                    {t('tour.players', { n: String(row.size) })} · {t(`tour.status.${row.status}` as 'tour.status.open')}
                  </span>
                </span>
                <span aria-hidden className="text-steppe-300">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
