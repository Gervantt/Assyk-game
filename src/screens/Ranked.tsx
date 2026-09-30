import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ornament } from '@/components/Ornament'
import { useT } from '@/i18n'
import { dequeueRanked, enqueueRanked, pollRanked } from '@/net/ranked'
import { hasBackend } from '@/net/supabase'
import { useAuthStore } from '@/store/useAuthStore'

/** Как часто спрашиваем сервер, не нашёлся ли соперник. */
const POLL_MS = 2500

type Stage = 'idle' | 'searching' | 'offline'

export function Ranked() {
  const t = useT()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const [stage, setStage] = useState<Stage>(hasBackend ? 'idle' : 'offline')
  const [seconds, setSeconds] = useState(0)
  const timer = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  // покидая экран, обязательно выходим из очереди: иначе соперник
  // подберётся к игроку, которого уже нет
  useEffect(() => {
    return () => {
      stop()
      void dequeueRanked()
    }
  }, [stop])

  const search = async () => {
    setStage('searching')
    setSeconds(0)
    const immediate = await enqueueRanked()
    if (immediate) {
      navigate(`/m/${immediate}`, { replace: true })
      return
    }
    timer.current = window.setInterval(async () => {
      setSeconds((s) => s + POLL_MS / 1000)
      const id = await pollRanked()
      if (id) {
        stop()
        navigate(`/m/${id}`, { replace: true })
      }
    }, POLL_MS)
  }

  const cancel = async () => {
    stop()
    await dequeueRanked()
    setStage('idle')
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-6">
      <Link to="/" className="self-start text-sm text-steppe-300">
        ← {t('common.menu')}
      </Link>

      <Ornament className="mx-auto my-5 h-3 w-40 text-gold-500/70" />
      <h1 className="text-center text-2xl font-extrabold text-steppe-50">{t('ranked.title')}</h1>
      <p className="mt-2 text-center text-sm text-steppe-300">{t('ranked.subtitle')}</p>

      <div className="mt-6 rounded-3xl bg-night-800 p-5 ring-1 ring-white/10">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-steppe-300">{t('ranked.yourRating')}</span>
          <b className="text-3xl font-extrabold text-gold-400">{profile?.rating ?? 1000}</b>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-steppe-400">{t('ranked.elo')}</p>
      </div>

      {stage === 'offline' && (
        <p className="mt-6 rounded-2xl bg-white/5 p-4 text-center text-sm text-steppe-300">
          {t('ranked.offline')}
        </p>
      )}

      {stage === 'idle' && (
        <button
          type="button"
          onClick={search}
          className="mt-6 min-h-[52px] w-full rounded-2xl bg-gold-400 text-lg font-bold text-night-900 transition-transform active:scale-95"
        >
          {t('ranked.search')}
        </button>
      )}

      {stage === 'searching' && (
        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3 text-steppe-100">
            <span className="h-3 w-3 animate-ping rounded-full bg-gold-400" />
            {t('ranked.searching')} · {Math.round(seconds)}с
          </div>
          <p className="text-center text-xs text-steppe-400">{t('ranked.searchHint')}</p>
          <button
            type="button"
            onClick={cancel}
            className="min-h-[44px] w-full rounded-2xl bg-white/10 font-bold text-steppe-50 ring-1 ring-white/15"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}
    </div>
  )
}
