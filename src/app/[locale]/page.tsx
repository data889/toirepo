import { useTranslations } from 'next-intl'
import { AdminHeaderLink } from '@/components/layout/AdminHeaderLink'
import { AuthStatus } from '@/components/layout/AuthStatus'
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher'
import { MapCanvas } from '@/components/map/MapCanvas'

export default function HomePage() {
  const t = useTranslations()
  return (
    <main
      className="bg-paper text-ink-primary"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        // 100dvh (dynamic viewport height) tracks the visible area as
        // the browser's URL bar shows/hides. iPhone Chrome was
        // computing 100vh LARGER than the visible area on first
        // paint, pushing <main> beyond the viewport and anchoring
        // initial scroll position past the top — so the <header>
        // below was painted but off-screen above the URL bar. iOS
        // Safari (bottom URL bar on recent versions) didn't hit this.
        // 100dvh + overflow:hidden fits main exactly in the visible
        // area; header sits at y=0 of visible viewport on both
        // browsers.
        height: '100dvh',
        // Push content below the notch / status bar on notched iPhones.
        // env(safe-area-inset-top) is 0 on non-notched hardware so
        // this is a no-op fallback on desktop / Android.
        paddingTop: 'env(safe-area-inset-top)',
        overflow: 'hidden',
      }}
    >
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-medium">{t('common.appName')}</h1>
        <div className="flex items-center gap-3">
          <AdminHeaderLink />
          <AuthStatus />
          <LocaleSwitcher />
        </div>
      </header>
      <section style={{ flex: 1, position: 'relative' }}>
        <MapCanvas
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      </section>
    </main>
  )
}
