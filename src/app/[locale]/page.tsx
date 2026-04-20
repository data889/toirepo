import { useTranslations } from 'next-intl'
import { AdminHeaderLink } from '@/components/layout/AdminHeaderLink'
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
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-medium">{t('common.appName')}</h1>
        <div className="flex items-center gap-4">
          <AdminHeaderLink />
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
