/*
 * Сервис-воркер Asyq League.
 *
 * Стратегия намеренно простая и осторожная: оболочку отдаём из кеша, но
 * обновляем в фоне (stale-while-revalidate), а всё сетевое — запросы к
 * Supabase — не трогаем вовсе. Кешировать ответы бэкенда здесь нельзя:
 * игрок увидел бы вчерашнюю таблицу лидеров и чужой ход в матче.
 */
const CACHE = 'asyq-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // чужие домены (Supabase, шрифты) — только сеть
  if (url.origin !== self.location.origin) return

  // навигация: сеть, при её отсутствии — сохранённая оболочка
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          void caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/').then((r) => r ?? Response.error())),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            void caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => cached ?? Response.error())
      return cached ?? network
    }),
  )
})
