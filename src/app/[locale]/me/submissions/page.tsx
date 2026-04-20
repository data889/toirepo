import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { auth } from '@/server/auth'
import { MySubmissionsList } from '@/components/me/MySubmissionsList'
import type { Locale } from '@/i18n/routing'

export default async function MySubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ just_submitted?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user) {
    redirect({ href: '/auth/signin', locale: locale as Locale })
  }

  const sp = await searchParams
  const t = await getTranslations('submissions')

  return (
    <main className="bg-paper text-ink-primary min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-ink-primary mb-6 text-2xl font-medium sm:text-3xl">{t('title')}</h1>
        <MySubmissionsList justSubmittedSlug={sp.just_submitted ?? null} />
      </div>
    </main>
  )
}
