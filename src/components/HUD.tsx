import { Link } from 'react-router-dom'
import { asyksInField } from '@/physics'
import type { MatchState } from '@/game/rules'
import { useT } from '@/i18n'
import { useGameStore } from '@/store/useGameStore'
import { useSettings } from '@/store/useSettings'
import { playSound, unlockAudio } from '@/audio'
import { PowerBar } from './PowerBar'
import { LocaleSwitch } from './LocaleSwitch'

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center leading-none">
      <span className="max-w-[72px] truncate text-[9px] uppercase tracking-wider text-steppe-300">
        {label}
      </span>
      <span className={`mt-1 text-base font-bold sm:text-lg ${accent ? 'text-gold-400' : 'text-steppe-50'}`}>
        {value}
      </span>
    </div>
  )
}

const ROUND_BTN =
  'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/50 text-steppe-50 ring-1 ring-white/15 backdrop-blur-sm hover:bg-black/65'

export function HUD({ match }: { match: MatchState }) {
  const t = useT()
  const camera = useGameStore((s) => s.camera)
  const setCamera = useGameStore((s) => s.setCamera)
  const phase = useGameStore((s) => s.phase)
  const sound = useSettings((s) => s.sound)
  const setSetting = useSettings((s) => s.set)

  const inKon = asyksInField(match.world).length
  const left = match.rules.throwsPerPlayer
    ? match.rules.throwsPerPlayer - match.players[match.currentPlayer]!.throwsUsed
    : null

  return (
    <>
      {/* верх: меню, счёт, язык */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 sm:p-3">
        <Link to="/" className={`pointer-events-auto shrink-0 px-3 text-sm font-semibold ${ROUND_BTN}`}>
          ←
          <span className="ml-1 hidden sm:inline">{t('hud.menu')}</span>
        </Link>

        <div className="pointer-events-none flex min-w-0 flex-1 items-center justify-center gap-3 rounded-2xl bg-black/50 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm sm:gap-5">
          {match.players.map((p) => (
            <Stat
              key={p.index}
              label={match.players.length > 1 ? p.name : t('hud.score')}
              value={String(p.score)}
              accent={match.players.length > 1 && p.index === match.currentPlayer}
            />
          ))}
          <Stat label={t('hud.inKon')} value={String(inKon)} />
          {left !== null && <Stat label={t('hud.throws')} value={String(Math.max(left, 0))} />}
        </div>

        <div className="pointer-events-auto shrink-0">
          <LocaleSwitch compact />
        </div>
      </div>

      {/* низ справа: звук и камера */}
      <div className="pointer-events-auto absolute bottom-24 right-2 flex flex-col gap-2 sm:bottom-28 sm:right-3">
        <button
          type="button"
          onClick={() => {
            const next = !sound
            setSetting('sound', next)
            if (next) {
              unlockAudio()
              playSound('tap')
            }
          }}
          aria-label={t('settings.sound')}
          aria-pressed={sound}
          className={`text-base ${ROUND_BTN}`}
        >
          {sound ? '🔊' : '🔇'}
        </button>
        <button
          type="button"
          onClick={() => setCamera(camera === 'top' ? 'player' : 'top')}
          aria-label={camera === 'top' ? t('hud.playerView') : t('hud.topView')}
          className={`text-base ${ROUND_BTN}`}
        >
          {camera === 'top' ? '👁' : '⬇'}
        </button>
      </div>

      {/* низ по центру: сила и подсказка */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-5 sm:p-4">
        <PowerBar />
        {phase === 'aim' && (
          <p className="max-w-[16rem] text-center text-xs text-steppe-300 sm:max-w-md sm:text-sm">
            {match.players.length > 1 && (
              <span className="mr-1 font-semibold text-gold-400">
                {t('hud.turn')}: {match.players[match.currentPlayer]!.name}.
              </span>
            )}
            {t('aim.hint')}
          </p>
        )}
      </div>
    </>
  )
}
