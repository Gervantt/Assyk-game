import { Link } from 'react-router-dom'
import { asyksInField } from '@/physics'
import type { MatchState } from '@/game/rules'
import { useT } from '@/i18n'
import { useGameStore } from '@/store/useGameStore'
import { PowerBar } from './PowerBar'
import { LocaleSwitch } from './LocaleSwitch'

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="text-[10px] uppercase tracking-widest text-steppe-300">{label}</span>
      <span className={`mt-1 text-lg font-bold ${accent ? 'text-gold-400' : 'text-steppe-50'}`}>
        {value}
      </span>
    </div>
  )
}

export function HUD({ match }: { match: MatchState }) {
  const t = useT()
  const camera = useGameStore((s) => s.camera)
  const setCamera = useGameStore((s) => s.setCamera)
  const phase = useGameStore((s) => s.phase)

  const inKon = asyksInField(match.world).length
  const left = match.rules.throwsPerPlayer
    ? match.rules.throwsPerPlayer - match.players[match.currentPlayer]!.throwsUsed
    : null

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <Link
          to="/"
          className="pointer-events-auto flex min-h-[44px] items-center rounded-full bg-black/45 px-4 text-sm font-semibold text-steppe-50 ring-1 ring-white/15 hover:bg-black/60"
        >
          ← {t('hud.menu')}
        </Link>

        <div className="pointer-events-none flex items-center gap-4 rounded-2xl bg-black/45 px-4 py-2 ring-1 ring-white/15 sm:gap-6">
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

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <LocaleSwitch compact />
          <button
            type="button"
            onClick={() => setCamera(camera === 'top' ? 'player' : 'top')}
            className="min-h-[44px] rounded-full bg-black/45 px-4 text-xs font-semibold text-steppe-50 ring-1 ring-white/15 hover:bg-black/60"
          >
            {camera === 'top' ? t('hud.playerView') : t('hud.topView')}
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-5 sm:p-4">
        <PowerBar />
        {phase === 'aim' && (
          <p className="max-w-xs text-center text-xs text-steppe-300 sm:max-w-md sm:text-sm">
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
