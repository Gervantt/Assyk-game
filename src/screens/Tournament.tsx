import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Ornament } from '@/components/Ornament'
import { useT } from '@/i18n'
import {
  advanceTournament,
  fetchTournament,
  joinTournament,
  startTournament,
  tournamentUrl,
  type BracketPair,
  type TournamentView,
} from '@/net/tournaments'
import { useAuthStore } from '@/store/useAuthStore'

/** Пока идёт турнир, сетка меняется у всех — перечитываем её раз в несколько секунд. */
const REFRESH_MS = 6000

function Pair({
  pair,
  nameOf,
  myId,
  t,
}: {
  pair: BracketPair
  nameOf: (id: string | null) => string
  myId: string | null
  t: ReturnType<typeof useT>
}) {
  const mine = pair.a === myId || pair.b === myId
  const playable = mine && pair.match && !pair.winner

  const side = (id: string | null) => (
    <span
      className={`block truncate text-sm ${
        pair.winner && pair.winner === id
          ? 'font-bold text-gold-400'
          : pair.winner
            ? 'text-steppe-400 line-through'
            : 'text-steppe-100'
      }`}
    >
      {nameOf(id)}
    </span>
  )

  return (
    <div
      className={`rounded-2xl p-3 ring-1 ${
        mine ? 'bg-night-800 ring-gold-400/30' : 'bg-night-800/60 ring-white/10'
      }`}
    >
      {side(pair.a)}
      <span className="my-1 block text-[10px] uppercase tracking-widest text-steppe-500">vs</span>
      {side(pair.b)}
      {playable && (
        <Link
          to={`/m/${pair.match}`}
          className="mt-2 flex min-h-[44px] items-center justify-center rounded-xl bg-gold-400 text-xs font-bold text-night-900"
        >
          {t('tour.playMatch')}
        </Link>
      )}
    </div>
  )
}

export function Tournament() {
  const t = useT()
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const myId = useAuthStore((s) => s.profile?.id ?? null)
  const [view, setView] = useState<TournamentView | null | 'missing'>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const reload = useCallback(async () => {
    if (!tournamentId) return
    const v = await fetchTournament(tournamentId)
    setView(v ?? 'missing')
  }, [tournamentId])

  useEffect(() => {
    void reload()
  }, [reload])

  // Победители продвигаются на сервере: он читает matches.winner, поэтому
  // достаточно периодически просить его пересчитать сетку.
  useEffect(() => {
    if (!tournamentId) return
    const id = window.setInterval(async () => {
      const v = view !== 'missing' && view ? view.tournament.status : null
      if (v === 'running') await advanceTournament(tournamentId)
      await reload()
    }, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [tournamentId, reload, view])

  if (view === 'missing') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-5">
        <p className="text-steppe-300">{t('tour.missing')}</p>
        <Link to="/tournaments" className="text-sm text-gold-400">
          {t('tour.title')} →
        </Link>
      </div>
    )
  }
  if (!view) {
    return (
      <div className="flex h-full items-center justify-center text-steppe-300">
        {t('common.loading')}
      </div>
    )
  }

  const { tournament, players } = view
  const joined = players.some((p) => p.id === myId)
  const owner = tournament.owner_id === myId
  const full = players.length >= tournament.size
  const nameOf = (id: string | null) =>
    id ? (players.find((p) => p.id === id)?.username ?? '—') : '—'
  const link = tournamentUrl(tournament.id)

  const champion =
    tournament.status === 'finished'
      ? (tournament.bracket[tournament.bracket.length - 1]?.[0]?.winner ?? null)
      : null

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-6">
      <Link to="/tournaments" className="self-start text-sm text-steppe-300">
        ← {t('tour.title')}
      </Link>

      <Ornament className="mx-auto my-4 h-3 w-40 text-gold-500/70" />
      <h1 className="text-center text-2xl font-extrabold text-steppe-50">{tournament.title}</h1>
      <p className="mt-1 text-center text-sm text-steppe-300">
        {t('tour.players', { n: String(tournament.size) })} ·{' '}
        {t(`tour.status.${tournament.status}` as 'tour.status.open')}
      </p>

      {champion && (
        <p className="mt-4 rounded-2xl bg-gold-400/15 p-4 text-center text-lg font-extrabold text-gold-400 ring-1 ring-gold-400/30">
          🏆 {nameOf(champion)}
        </p>
      )}

      {/* ── Набор участников ─────────────────────────────────────────────── */}
      {tournament.status === 'open' && (
        <div className="mt-5 rounded-3xl bg-night-800 p-5 ring-1 ring-white/10">
          <p className="text-xs uppercase tracking-widest text-steppe-400">
            {t('tour.joined', { n: String(players.length), max: String(tournament.size) })}
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {players.map((p) => (
              <li key={p.id} className="truncate text-sm text-steppe-100">
                {p.seed_no}. {p.username}
                {p.id === myId && <span className="text-gold-400"> ({t('player.you')})</span>}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(link)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            }}
            className="mt-4 min-h-[44px] w-full rounded-2xl bg-white/10 text-sm font-bold text-steppe-50 ring-1 ring-white/15"
          >
            {copied ? t('online.copied') : t('tour.invite')}
          </button>

          {!joined && (
            <button
              type="button"
              disabled={busy || full}
              onClick={async () => {
                setBusy(true)
                await joinTournament(tournament.id)
                await reload()
                setBusy(false)
              }}
              className="mt-2 min-h-[48px] w-full rounded-2xl bg-gold-400 font-bold text-night-900 disabled:opacity-40"
            >
              {full ? t('tour.noSeats') : t('tour.join')}
            </button>
          )}

          {owner && (
            <button
              type="button"
              disabled={!full || busy}
              onClick={async () => {
                setBusy(true)
                await startTournament(tournament.id)
                await reload()
                setBusy(false)
              }}
              className="mt-2 min-h-[48px] w-full rounded-2xl bg-gold-400 font-bold text-night-900 disabled:opacity-40"
            >
              {full ? t('tour.start') : t('tour.needMore', { n: String(tournament.size - players.length) })}
            </button>
          )}
        </div>
      )}

      {/* ── Сетка ────────────────────────────────────────────────────────── */}
      {tournament.status !== 'open' && (
        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {tournament.bracket.map((round, ri) => (
            <div key={ri} className="flex min-w-[46%] flex-col gap-3">
              <p className="text-center text-[10px] uppercase tracking-widest text-steppe-400">
                {ri === tournament.bracket.length - 1
                  ? t('tour.final')
                  : t('tour.round', { n: String(ri + 1) })}
              </p>
              {round.map((pair, pi) => (
                <Pair key={pi} pair={pair} nameOf={nameOf} myId={myId} t={t} />
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-steppe-400">{t('tour.note')}</p>
    </div>
  )
}
