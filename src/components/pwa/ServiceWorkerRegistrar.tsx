'use client'

import { useEffect } from 'react'

// Registers /sw.js once on mount. Renders nothing.
//
// Notes:
// - Browsers gate SW registration to secure contexts (HTTPS, localhost,
//   127.0.0.1). Accessing dev via LAN IP (e.g. http://192.168.x.x:3000)
//   will usually skip registration silently; iOS Safari in particular
//   won't register SW on non-secure origins. That's fine — the PWA
//   "Add to Home Screen" + standalone display still work on iOS without
//   a registered SW (manifest alone is enough for the install flow).
//   Full offline / cache capability waits on M10 HTTPS deployment.
// - Errors are logged, not surfaced — a dev machine without SW doesn't
//   break anything.

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => {
        console.warn('[toirepo SW] registration failed:', e)
      })
    }

    if (document.readyState === 'complete') {
      onLoad()
    } else {
      window.addEventListener('load', onLoad, { once: true })
      return () => window.removeEventListener('load', onLoad)
    }
  }, [])

  return null
}
