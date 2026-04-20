import { setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { auth } from '@/server/auth'
import { AppHeader } from '@/components/layout/AppHeader'
import { SubmitForm } from '@/components/submit/SubmitForm'
import type { Locale } from '@/i18n/routing'

export default async function SubmitPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user) {
    // signin page ignores callbackUrl (its server-action hardcodes /${locale});
    // users land back on the map after signing in and re-tap the FAB.
    redirect({ href: '/auth/signin', locale: locale as Locale })
  }

  return (
    <>
      <AppHeader />
      <main className="bg-paper text-ink-primary min-h-screen">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <SubmitForm />
        </div>
      </main>
    </>
  )
}
