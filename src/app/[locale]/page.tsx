import { useTranslations } from 'next-intl'
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher'

export default function HomePage() {
  const t = useTranslations()

  return (
    <main className="bg-paper text-ink-primary min-h-screen px-6 py-8">
      <header className="mb-16 flex items-center justify-between">
        <h1 className="text-2xl font-medium">{t('common.appName')}</h1>
        <LocaleSwitcher />
      </header>

      <section className="mx-auto max-w-2xl text-center">
        <h2 className="mb-4 text-4xl font-medium">{t('home.welcome')}</h2>
        <p className="text-ink-secondary mb-8 text-lg">{t('home.description')}</p>
        <p className="text-ink-tertiary text-sm">{t('home.comingSoon')}</p>
      </section>
    </main>
  )
}
