import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { asyksInField } from '@/physics'
import { GameView } from '@/game/GameView'
import { Ornament } from '@/components/Ornament'
import { CameraToggle } from '@/components/CameraToggle'
import { PowerBar } from '@/components/PowerBar'
import { useT } from '@/i18n'
import { usePopupStore } from '@/game/fx/popupStore'
import { useGameStore } from '@/store/useGameStore'
import { installMatchDebug, useMatchStore } from '@/store/useMatchStore'
import { requestRating, type RatingChange } from '@/net/ranked'

/** Ссылка-приглашение на этот матч. */
function inviteUrl(matchId: string): string {
  return `${window.location.origin}/m/${matchId}`
}

function QrCode({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // грузим генератор только на экране ожидания
    void import('qrcode').then(async (QR) => {
      const data = await QR.toDataURL(url, {
        width: 208,
        margin: 1,
        color: { dark: '#0d1017', light: '#f6f2e8' },
      })
      if (!cancelled) setSrc(data)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  if (!src) return <div className="h-52 w-52 animate-pulse rounded-2xl bg-white/10" />
  return <img src={src} alt="QR" width={208} height={208} className="rounded-2xl" />
}

export function OnlineMatch() {
  const t = useT()
  const navigate = useNavigate()
  const { matchId } = useParams<{ matchId: string }>()

  const { status, row, opponentOnline, desyncs, open, leave, myId } = useMatchStore()
  const match = useGameStore((s) => s.match)
  const phase = useGameStore((s) => s.phase)
  const [copied, setCopied] = useState(false)
  const [rating, setRating] = useState<RatingChange | null>(null)

  // Рейтинговый матч доигран — просим сервер пересчитать партию и начислить
  // ELO. Вызвать может любой из двоих, функция идемпотентна.
  const ranked = row?.mode === 'ranked'
  useEffect(() => {
    if (!ranked || status !== 'finished' || !matchId || !myId || rating) return
    let cancelled = false
    void requestRating(matchId, myId).then((r) => {
      if (!cancelled && r) setRating(r)
    })
    return () => {
      cancelled = true
    }
  }, [ranked, status, matchId, myId, rating])

  useEffect(() => {
    if (!matchId) return
    installMatchDebug()
    void open(matchId)
    return () => {
      leave()
      usePopupStore.getState().clear()
    }
  }, [matchId, open, leave])

  const url = useMemo(() => (matchId ? inviteUrl(matchId) : ''), [matchId])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // буфер недоступен — ссылку всё равно видно на экране
    }
  }, [url])

  const myIndex = row && myId ? (row.player1 === myId ? 0 : 1) : 0
  const isMyTurn = Boolean(row && myId && row.current_turn === myId)

  if (status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-night-900 p-6 text-center">
        <p className="text-sm text-steppe-300">{t('online.error')}</p>
        <Link
          to="/"
          className="min-h-[44px] rounded-2xl bg-gold-400 px-6 py-3 font-bold text-night-900"
        >
          {t('result.home')}
        </Link>
      </div>
    )
  }

  if (status === 'connecting' || !match) {
    return (
      <div className="flex h-full items-center justify-center bg-night-900 text-steppe-300">
        {t('common.loading')}
      </div>
    )
  }

  // ── экран ожидания соперника ────────────────────────────────────────────
  if (status === 'waiting') {
    return (
      <div className="min-h-full overflow-y-auto bg-night-900">
        <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 py-8">
          <Link
            to="/"
            className="self-start rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-steppe-50 ring-1 ring-white/10"
          >
            ← {t('rules.back')}
          </Link>

          <Ornament className="mx-auto my-5 h-3 w-40 text-gold-500/70" />
          <h1 className="text-center text-2xl font-extrabold text-steppe-50">
            {t('online.waiting')}
          </h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-steppe-300">
            {t('online.waitingHint')}
          </p>
          <p className="mt-3 rounded-2xl bg-sky-550/15 px-4 py-2 text-center text-xs leading-relaxed text-sky-450 ring-1 ring-sky-450/25">
            {t('online.alternate')}
          </p>

          <div className="mt-6 flex h-3 items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 animate-pulse rounded-full bg-gold-400"
                style={{ animationDelay: `${i * 220}ms` }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={copy}
            className="mt-6 min-h-[44px] w-full rounded-2xl bg-gold-400 font-bold text-night-900 transition-transform active:scale-95"
          >
            {copied ? t('online.copied') : t('online.copy')}
          </button>

          <code className="mt-3 w-full break-all rounded-xl bg-black/40 px-3 py-2 text-center text-[11px] text-steppe-300 ring-1 ring-white/10">
            {url}
          </code>

          <p className="mt-6 text-xs text-steppe-300">{t('online.qr')}</p>
          <div className="mt-3 rounded-2xl bg-steppe-50 p-2">
            <QrCode url={url} />
          </div>
        </div>
      </div>
    )
  }

  // ── сам матч ────────────────────────────────────────────────────────────
  const inKon = asyksInField(match.world).length

  return (
    <GameView match={match} canThrow={isMyTurn}>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 p-2">
        <Link
          to="/"
          className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/45 text-sm font-semibold text-steppe-50 ring-1 ring-white/15 backdrop-blur-sm"
        >
          ←
        </Link>

        <div className="flex h-10 min-w-0 flex-1 items-center justify-center gap-3 rounded-full bg-black/45 px-3 ring-1 ring-white/15 backdrop-blur-sm">
          {match.players.map((p, i) => (
            <span key={p.index} className="flex items-baseline gap-1">
              <span
                className={`max-w-[96px] truncate text-[10px] uppercase tracking-wider ${
                  i === myIndex ? 'text-gold-400' : 'text-steppe-300'
                }`}
                title={p.name}
              >
                {p.name}
              </span>
              <b className="text-sm text-steppe-50">{p.score}</b>
            </span>
          ))}
          <span className="text-xs text-steppe-300">·</span>
          <span className="text-xs text-steppe-300">{inKon}</span>
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${opponentOnline ? 'bg-emerald-400' : 'bg-white/25'}`}
            title={opponentOnline ? t('online.online') : t('online.offline')}
          />
        </div>
      </div>

      <CameraToggle className="absolute bottom-24 right-3" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-5">
        <PowerBar />
        {phase === 'aim' && (
          <p className="text-xs font-semibold text-steppe-300">
            {isMyTurn ? (
              <span className="text-gold-400">{t('online.yourTurn')}</span>
            ) : (
              t('online.theirTurn')
            )}
          </p>
        )}
        {desyncs > 0 && (
          <p className="rounded-full bg-sky-550/25 px-3 py-1 text-[10px] text-sky-450">
            {t('online.desync')} · {desyncs}
          </p>
        )}
      </div>

      {status === 'finished' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-night-900/88 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-night-800 p-6 text-center ring-1 ring-white/10">
            <Ornament className="mx-auto mb-3 h-3 w-40 text-gold-500/70" />
            <h2 className="text-2xl font-extrabold text-steppe-50">{t('online.finished')}</h2>
            <p className="mt-3 text-lg font-bold text-gold-400">
              {match.players.map((p) => `${p.name}: ${p.score}`).join(' · ')}
            </p>
            {ranked && (
              <p className="mt-2 text-sm text-steppe-200">
                {rating ? (
                  <>
                    {t('ranked.rating')}:{' '}
                    <b className={rating.delta >= 0 ? 'text-gold-400' : 'text-sky-450'}>
                      {rating.delta >= 0 ? '+' : ''}
                      {rating.delta}
                    </b>{' '}
                    → {rating.rating}
                  </>
                ) : (
                  t('ranked.counting')
                )}
              </p>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-6 min-h-[44px] w-full rounded-2xl bg-gold-400 font-bold text-night-900"
            >
              {t('result.home')}
            </button>
          </div>
        </div>
      )}
    </GameView>
  )
}
