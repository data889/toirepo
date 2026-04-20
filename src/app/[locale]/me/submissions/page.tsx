import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect, Link } from '@/i18n/navigation'
import { auth } from '@/server/auth'
import { SubmissionsList } from './SubmissionsList'
import type { Locale } from '@/i18n/routing'

export default async function MySubmissionsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user) {
    redirect({ href: '/auth/signin', locale: locale as Locale })
  }

  const t = await getTranslations('submissions')

  return (
    <main className="bg-paper text-ink-primary min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-ink-primary text-2xl font-medium sm:text-3xl">{t('title')}</h1>
          <Link
            href="/"
            className="text-ink-secondary hover:text-ink-primary text-sm underline underline-offset-4 hover:no-underline"
          >
            {t('backToMap')}
          </Link>
        </div>

        <SubmissionsList />
      </div>
    </main>
  )
}
