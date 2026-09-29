import { useT } from '@/i18n'
import { useGameStore } from '@/store/useGameStore'

/** Переключатель «вид сверху» для прицеливания. Выбор запоминается на сессию. */
export function CameraToggle({ className = '' }: { className?: string }) {
  const t = useT()
  const camera = useGameStore((s) => s.camera)
  const setCamera = useGameStore((s) => s.setCamera)
  const top = camera === 'top'

  return (
    <button
      type="button"
      onClick={() => setCamera(top ? 'player' : 'top')}
      aria-label={top ? t('hud.playerView') : t('hud.topView')}
      aria-pressed={top}
      className={`pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/50 text-base text-steppe-50 ring-1 ring-white/15 backdrop-blur-sm hover:bg-black/65 ${className}`}
    >
      {top ? '👁' : '⬇'}
    </button>
  )
}
