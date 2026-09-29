import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { useI18n } from './i18n'
import { useAuthStore } from './store/useAuthStore'
import './index.css'

document.documentElement.lang = useI18n.getState().locale

// Гостевая сессия и обмен прогрессом поднимаются в фоне: игра не ждёт сеть.
void useAuthStore.getState().init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
