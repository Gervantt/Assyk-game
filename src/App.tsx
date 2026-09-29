import { Navigate, Route, Routes } from 'react-router-dom'
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

export function App() {
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
      <Route path="/rules" element={<Rules />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
