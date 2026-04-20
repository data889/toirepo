import { setRequestLocale, getTranslations } from 'next-intl/server'
import { AppHeader } from '@/components/layout/AppHeader'
import { AdminQueueList } from '@/components/admin/AdminQueueList'

export default async function AdminQueuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin')

  return (
    <>
      <AppHeader />
      <main className="bg-paper text-ink-primary min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <h1 className="text-ink-primary mb-6 text-2xl font-medium sm:text-3xl">
            {t('queue.title')}
          </h1>
          <AdminQueueList />
        </div>
      </main>
    </>
  )
}
