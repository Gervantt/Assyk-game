import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AimState } from '@/physics'
import { GameView } from '@/game/GameView'
import { PowerBar } from '@/components/PowerBar'
import { CameraToggle } from '@/components/CameraToggle'
import { Ornament } from '@/components/Ornament'
import { useT } from '@/i18n'
import type { DictKey } from '@/i18n'
import { markTutorialDone } from '@/lib/progress'
import { usePopupStore } from '@/game/fx/popupStore'
import { useGameStore } from '@/store/useGameStore'

type Step = 1 | 2 | 3 | 'done'

/** Зона силы, которую нужно поймать на втором шаге. */
const POWER_ZONE: [number, number] = [0.45, 0.85]
/** Готовые углы подъёма: новичку остаётся думать только о силе. */
const PRESETS: Array<{ key: 'tut.preset.low' | 'tut.preset.mid' | 'tut.preset.high'; deg: number }> = [
  { key: 'tut.preset.low', deg: 5 },
  { key: 'tut.preset.mid', deg: 25 },
  { key: 'tut.preset.high', deg: 50 },
]
/** Запас по промаху мимо кона на первом шаге. */
const AIM_SLACK = 0.4

const STEP_TEXT: Record<1 | 2 | 3, { title: DictKey; body: DictKey; fail: DictKey }> = {
  1: { title: 'tut.1.title', body: 'tut.1.body', fail: 'tut.1.fail' },
  2: { title: 'tut.2.title', body: 'tut.2.body', fail: 'tut.2.fail' },
  3: { title: 'tut.3.title', body: 'tut.3.body', fail: 'tut.3.retry' },
}

/**
 * Обучение из трёх шагов: прицелься -> выбери силу -> выбей асық.
 * Провалить нельзя: неудачный бросок просто не засчитывается и объясняется.
 */
export function Tutorial() {
  const t = useT()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [nudge, setNudge] = useState(false)
  const [preset, setPreset] = useState<number | null>(null)

  const match = useGameStore((s) => s.match)
  const phase = useGameStore((s) => s.phase)
  const lastSummary = useGameStore((s) => s.lastSummary)
  const startSession = useGameStore((s) => s.startSession)
  const leave = useGameStore((s) => s.leave)

  const seenTurns = useRef(0)

  useEffect(() => {
    startSession({
      mode: 'tutorial',
      layout: { kind: 'row', count: 3, fieldRadius: 1.3 },
      rules: { throwsPerPlayer: 0, goal: 0, sakaInFieldPenalty: false, extraThrowOnKnockOut: false },
    })
    return () => {
      leave()
      usePopupStore.getState().clear()
    }
  }, [startSession, leave])

  // шаг засчитывается, когда бросок долетел и тела остановились
  useEffect(() => {
    if (!match) return
    if (match.turnNo === seenTurns.current) return
    if (phase === 'animating') return
    seenTurns.current = match.turnNo

    setNudge(false)
    setStep((current) => {
      if (current === 1) return 2
      if (current === 2) return 3
      if (current === 3) {
        if (lastSummary && lastSummary.points > 0) return 'done'
        setNudge(true)
        return 3
      }
      return current
    })
  }, [match, phase, lastSummary])

  useEffect(() => {
    if (step === 'done') markTutorialDone()
  }, [step])

  const aimsAtKon = useCallback(
    (aim: AimState) => {
      if (!match || aim.dirY <= 0.3) return false
      const distanceToLine = Math.abs((match.world.field.cy - match.world.throwLineY) * aim.dirX)
      return distanceToLine <= match.world.field.radius + AIM_SLACK
    },
    [match],
  )

  const gate = useCallback(
    (aim: AimState) => {
      let ok = true
      if (step === 1) ok = aimsAtKon(aim)
      else if (step === 2) ok = aimsAtKon(aim) && aim.power >= POWER_ZONE[0] && aim.power <= POWER_ZONE[1]
      if (!ok) setNudge(true)
      return ok
    },
    [step, aimsAtKon],
  )

  if (!match || match.mode !== 'tutorial') {
    return (
      <div className="flex h-full items-center justify-center text-steppe-300">
        {t('common.loading')}
      </div>
    )
  }

  const stepText = step === 'done' ? null : STEP_TEXT[step]

  return (
    <GameView match={match} gate={gate} elevationLock={preset}>
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        <div className="mx-auto max-w-sm rounded-2xl bg-black/60 p-4 ring-1 ring-white/15 backdrop-blur-sm">
          {stepText && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gold-400">
                  {t('tut.step')} {step} / 3
                </span>
                <Link
                  to="/"
                  className="pointer-events-auto -m-2 p-2 text-[11px] font-semibold text-steppe-300 hover:text-steppe-50"
                >
                  {t('tut.skip')}
                </Link>
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-steppe-50">{t(stepText.title)}</h2>
              <p className="mt-1 text-sm leading-relaxed text-steppe-100">{t(stepText.body)}</p>
              {nudge && (
                <p className="mt-2 rounded-xl bg-sky-550/25 p-2 text-xs leading-relaxed text-sky-450 ring-1 ring-sky-450/30">
                  {t(stepText.fail)}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <CameraToggle className="absolute bottom-32 right-3" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-5">
        {step !== 'done' && (
          <div className="pointer-events-auto flex gap-2">
            {PRESETS.map((item) => {
              const rad = (item.deg * Math.PI) / 180
              const on = preset !== null && Math.abs(preset - rad) < 1e-6
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPreset(on ? null : rad)}
                  aria-pressed={on}
                  className={`min-h-[44px] rounded-full px-4 text-xs font-bold ring-1 transition-colors ${
                    on
                      ? 'bg-gold-400 text-night-900 ring-gold-400'
                      : 'bg-black/50 text-steppe-50 ring-white/15'
                  }`}
                >
                  {t(item.key)}
                </button>
              )
            })}
          </div>
        )}
        <PowerBar zone={step === 2 ? POWER_ZONE : undefined} />
      </div>

      {step === 'done' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-night-900/88 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-night-800 p-6 text-center ring-1 ring-white/10">
            <Ornament className="mx-auto mb-3 h-3 w-40 text-gold-500/70" />
            <h2 className="text-2xl font-extrabold text-steppe-50">{t('tut.done.title')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-steppe-300">{t('tut.done.body')}</p>
            <button
              type="button"
              onClick={() => navigate('/campaign')}
              className="mt-6 min-h-[44px] w-full rounded-2xl bg-gold-400 font-bold text-night-900 transition-transform active:scale-95"
            >
              {t('tut.done.go')}
            </button>
            <Link
              to="/"
              className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-2xl text-sm font-semibold text-steppe-300 hover:text-steppe-50"
            >
              {t('result.home')}
            </Link>
          </div>
        </div>
      )}
    </GameView>
  )
}
