import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ornament } from '@/components/Ornament'
import { useT } from '@/i18n'
import { fetchLeague, weekStart, type LeagueRow } from '@/net/league'
import { hasBackend } from '@/net/supabase'
import { useAuthStore } from '@/store/useAuthStore'

/** Сдвиг недели: 0 — текущая, −1 — прошлая. */
function shiftWeek(iso: string, weeks: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

export function League() {
  const t = useT()
  const profile = useAuthStore((s) => s.profile)
  const [offset, setOffset] = useState(0)
  const [rows, setRows] = useState<LeagueRow[] | null>(null)

  const week = useMemo(() => shiftWeek(weekStart(), offset), [offset])

  useEffect(() => {
    let cancelled = false
    setRows(null)
    void fetchLeague(week).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [week])

  const ranked = (rows ?? []).filter((r) => r.points > 0)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-6">
      <Link to="/" className="self-start text-sm text-steppe-300">
        ← {t('common.menu')}
      </Link>

      <Ornament className="mx-auto my-5 h-3 w-40 text-gold-500/70" />
      <h1 className="text-center text-2xl font-extrabold text-steppe-50">{t('league.title')}</h1>
      <p className="mt-2 text-center text-sm text-steppe-300">{t('league.subtitle')}</p>

      <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          className="min-h-[36px] rounded-xl px-3 text-sm text-steppe-200"
        >
          ←
        </button>
        <span className="text-xs uppercase tracking-widest text-steppe-300">
          {offset === 0 ? t('league.thisWeek') : week}
        </span>
        <button
          type="button"
          disabled={offset >= 0}
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          className="min-h-[36px] rounded-xl px-3 text-sm text-steppe-200 disabled:opacity-30"
        >
          →
        </button>
      </div>

      {!hasBackend && (
        <p className="mt-6 rounded-2xl bg-white/5 p-4 text-center text-sm text-steppe-300">
          {t('league.offline')}
        </p>
      )}

      {hasBackend && rows === null && (
        <p className="mt-6 text-center text-sm text-steppe-300">{t('common.loading')}</p>
      )}

      {hasBackend && rows !== null && ranked.length === 0 && (
        <p className="mt-6 rounded-2xl bg-white/5 p-4 text-center text-sm text-steppe-300">
          {t('league.empty')}
        </p>
      )}

      <ol className="mt-4 flex flex-col gap-2">
        {ranked.map((r, i) => {
          const mine = profile?.university_id === r.university_id
          return (
            <li
              key={r.university_id}
              className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${
                mine ? 'bg-gold-400/15 ring-gold-400/40' : 'bg-night-800 ring-white/10'
              }`}
            >
              <span className="w-6 shrink-0 text-center text-sm font-bold text-gold-400">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-steppe-50">{r.name}</span>
                <span className="block truncate text-[11px] text-steppe-400">
                  {r.city} · {t('league.students', { n: String(r.students) })} ·{' '}
                  {t('league.breakdown', {
                    daily: String(r.daily_points),
                    wins: String(r.ranked_wins),
                  })}
                </span>
              </span>
              <b className="shrink-0 text-lg text-steppe-50">{r.points}</b>
            </li>
          )
        })}
      </ol>

      <p className="mt-6 text-center text-xs leading-relaxed text-steppe-400">
        {t('league.formula')}
      </p>
    </div>
  )
}
