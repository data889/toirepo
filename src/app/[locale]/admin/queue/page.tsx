import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { AdminQueueList } from '@/components/admin/AdminQueueList'

export default async function AdminQueuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin')

  return (
    <main className="bg-paper text-ink-primary min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-ink-primary text-2xl font-medium sm:text-3xl">{t('queue.title')}</h1>
          <Link
            href="/"
            className="text-ink-secondary hover:text-ink-primary text-sm underline underline-offset-4 hover:no-underline"
          >
            {t('queue.backToMap')}
          </Link>
        </div>
        <AdminQueueList />
      </div>
    </main>
  )
}
