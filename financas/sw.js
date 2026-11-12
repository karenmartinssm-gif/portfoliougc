// Service worker do Finanças: deixa o app abrir rápido e instalável.
// Nunca guarda dados do Supabase (saldos, lançamentos): eles sempre vêm da internet.
const CACHE = 'financas-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icone.svg', './icone-192.png', './icone-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, fontes etc.: direto da internet

  // Páginas: tenta a internet primeiro (versão mais nova); sem internet, usa a cópia guardada
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  // Arquivos do app (nomes mudam a cada versão): guarda e reaproveita
  if (url.pathname.includes('/assets/') || SHELL.some((p) => url.pathname.endsWith(p.replace('./', '/')))) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
        return res
      })),
    )
  }
})
