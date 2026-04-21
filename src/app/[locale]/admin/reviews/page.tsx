import { setRequestLocale, getTranslations } from 'next-intl/server'
import { AppHeader } from '@/components/layout/AppHeader'
import { AdminNav } from '@/components/admin/AdminNav'
import { AdminReviewsList } from '@/components/admin/AdminReviewsList'

export default async function AdminReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin.reviews')

  return (
    <>
      <AppHeader />
      <main className="bg-paper text-ink-primary min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <h1 className="text-ink-primary mb-2 text-2xl font-medium sm:text-3xl">{t('title')}</h1>
          <AdminNav />
          <AdminReviewsList />
        </div>
      </main>
    </>
  )
}
