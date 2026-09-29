import { Navigate, Route, Routes } from 'react-router-dom'
import { Home } from '@/screens/Home'
import { Play } from '@/screens/Play'
import { Rules } from '@/screens/Rules'
import { Settings } from '@/screens/Settings'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play/:mode" element={<Play />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
