// toirepo service worker · M9 P1
//
// Hand-written (no Serwist / next-pwa library) to avoid Turbopack /
// Next 16 compat uncertainty for MVP. Scope and capabilities are
// deliberately narrow:
//
//   - Precache a tiny shell (the root redirect + manifest).
//   - Stale-while-revalidate for /api/trpc/toilet.list* so the map
//     keeps marker data warm across reloads.
//   - Cache-first for pmtiles tile requests (they're immutable per
//     upload; full expiry handled by cache bust on redeploy).
//   - Everything else falls through to the network.
//
// Scope is "/" so the SW captures every locale prefix. Cache name
// includes a version suffix so future schema changes just require
// bumping CACHE_VERSION to wipe old entries.

const CACHE_VERSION = 'v1'
const CACHE_NAME = `toirepo-${CACHE_VERSION}`
const PRECACHE_URLS = ['/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((e) => console.warn('[SW] precache failed:', e)),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('toirepo-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Cross-origin tile data on R2 (pmtiles / png sprites).
  const isPmtiles =
    url.pathname.endsWith('.pmtiles') ||
    url.hostname.endsWith('.r2.dev') ||
    url.hostname.endsWith('.r2.cloudflarestorage.com')
  if (isPmtiles) {
    event.respondWith(cacheFirst(request))
    return
  }

  // tRPC GET batches for toilet.list — map marker data.
  if (url.pathname.startsWith('/api/trpc/toilet.list')) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Everything else: default network behavior.
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (e) {
    // Network failure and no cache: propagate so the caller sees it.
    throw e
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch((e) => {
      if (cached) return cached
      throw e
    })
  return cached || fetchPromise
}
