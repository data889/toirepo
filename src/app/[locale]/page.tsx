import { useTranslations } from 'next-intl'
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher'
import { MapCanvas } from '@/components/map/MapCanvas'

export default function HomePage() {
  const t = useTranslations()

  return (
    <main className="bg-paper text-ink-primary flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-medium">{t('common.appName')}</h1>
        <LocaleSwitcher />
      </header>
      <section className="relative flex-1">
        <MapCanvas className="absolute inset-0" />
      </section>
    </main>
  )
}
