import { setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { auth } from '@/server/auth'
import type { Locale } from '@/i18n/routing'

// Shared gate for every /admin/* route. Signin-first (UNAUTHENTICATED
// bounces to /auth/signin) then role-check (non-ADMIN bounces to /).
// Keeping it in the layout avoids duplicating the auth() round-trip
// in each child page.

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth()
  // i18n redirect() throws internally, but its declared return type isn't
  // `never`, so narrow manually via explicit returns after each branch.
  if (!session?.user) {
    redirect({ href: '/auth/signin', locale: locale as Locale })
    return null
  }
  if (session.user.role !== 'ADMIN') {
    redirect({ href: '/', locale: locale as Locale })
    return null
  }

  return <>{children}</>
}
