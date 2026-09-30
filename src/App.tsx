import { useSyncExternalStore } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { onboarding } from '@/lib/progress'
import { Home } from '@/screens/Home'
import { Play } from '@/screens/Play'
import { Rules } from '@/screens/Rules'
import { Settings } from '@/screens/Settings'
import { Campaign } from '@/screens/Campaign'
import { LevelPlay } from '@/screens/LevelPlay'
import { Tutorial } from '@/screens/Tutorial'
import { Daily } from '@/screens/Daily'
import { Profile } from '@/screens/Profile'
import { OnlineMatch } from '@/screens/OnlineMatch'
import { Ranked } from '@/screens/Ranked'
import { NewMatch } from '@/screens/NewMatch'
import { Welcome } from '@/screens/Welcome'
import { League } from '@/screens/League'
import { Editor } from '@/screens/Editor'
import { CustomFeed } from '@/screens/CustomFeed'
import { CustomPlay } from '@/screens/CustomPlay'
import { Shop } from '@/screens/Shop'
import { Pro } from '@/screens/Pro'
import { Tournaments } from '@/screens/Tournaments'
import { Tournament } from '@/screens/Tournament'

export function App() {
  const onboarded = useOnboarded()
  const location = useLocation()

  // Первый запуск: сначала знакомство. Ссылку на матч или испытание при
  // этом не перехватываем — иначе приглашение от друга уводило бы на анкету.
  const shareLink = location.pathname.startsWith('/m/') || location.pathname.startsWith('/c/')
  if (!onboarded && location.pathname !== '/welcome' && !shareLink) {
    return <Navigate to="/welcome" replace />
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play/:mode" element={<Play />} />
      <Route path="/tutorial" element={<Tutorial />} />
      <Route path="/campaign" element={<Campaign />} />
      <Route path="/campaign/:levelId" element={<LevelPlay />} />
      <Route path="/daily" element={<Daily />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/m/:matchId" element={<OnlineMatch />} />
      <Route path="/ranked" element={<Ranked />} />
      <Route path="/new-match" element={<NewMatch />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/league" element={<League />} />
      <Route path="/editor" element={<Editor />} />
      <Route path="/custom" element={<CustomFeed />} />
      <Route path="/c/:levelId" element={<CustomPlay />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/pro" element={<Pro />} />
      <Route path="/tournaments" element={<Tournaments />} />
      <Route path="/t/:tournamentId" element={<Tournament />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/**
 * Представился ли игрок. Читаем через useSyncExternalStore, чтобы после
 * сохранения имени на экране знакомства редирект пропал без перезагрузки.
 */
let onboardTick = 0
const listeners = new Set<() => void>()

export function notifyOnboarded(): void {
  onboardTick++
  for (const l of listeners) l()
}

function useOnboarded(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => onboarding() !== null,
    () => true,
  )
}
