import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { useI18n } from './i18n'
import { useAuthStore } from './store/useAuthStore'
import { installGameDebug } from './store/useGameStore'
import './index.css'

document.documentElement.lang = useI18n.getState().locale

// Гостевая сессия и обмен прогрессом поднимаются в фоне: игра не ждёт сеть.
void useAuthStore.getState().init()
installGameDebug()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Экран загрузки в index.html убираем только после первой отрисовки:
// иначе между «шторкой» и готовым интерфейсом мелькает белое окно.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const boot = document.getElementById('boot')
    if (!boot) return
    boot.classList.add('done')
    window.setTimeout(() => boot.remove(), 400)
  })
})

// PWA: только в сборке. В dev сервис-воркер мешает горячей перезагрузке.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* установка PWA не обязательна — игра работает и без неё */
    })
  })
}
