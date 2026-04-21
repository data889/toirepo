import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { auth } from '@/server/auth'
import { AppHeader } from '@/components/layout/AppHeader'
import { MeTabsNav, type MeTab } from '@/components/me/MeTabsNav'
import { MySubmissionsList } from '@/components/me/MySubmissionsList'
import { MyReviewsList } from '@/components/me/MyReviewsList'
import { MyAppealsList } from '@/components/me/MyAppealsList'
import type { Locale } from '@/i18n/routing'

const VALID_TABS = new Set<MeTab>(['submissions', 'reviews', 'appeals'])

export default async function MePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string; just_submitted?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user) {
    redirect({ href: '/auth/signin', locale: locale as Locale })
  }

  const sp = await searchParams
  const t = await getTranslations('me')

  // Default to submissions when no tab or unknown tab. Any external
  // /me/submissions?just_submitted=… link still works because it
  // forwards (see /me/submissions/page.tsx) to /me?tab=submissions.
  const activeTab: MeTab = VALID_TABS.has(sp.tab as MeTab) ? (sp.tab as MeTab) : 'submissions'

  return (
    <>
      <AppHeader />
      <main className="bg-paper text-ink-primary min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <h1 className="text-ink-primary mb-2 text-2xl font-medium sm:text-3xl">
            {t('rootTitle')}
          </h1>
          <MeTabsNav active={activeTab} />
          {activeTab === 'submissions' && (
            <MySubmissionsList justSubmittedSlug={sp.just_submitted ?? null} />
          )}
          {activeTab === 'reviews' && <MyReviewsList />}
          {activeTab === 'appeals' && <MyAppealsList />}
        </div>
      </main>
    </>
  )
}
