import { redirect } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

// M7 P2.3: /me became a tabbed root page with submissions / reviews /
// appeals as ?tab= variants. This subpath stays for backward
// compatibility with external links (e.g. SubmitForm's redirect after
// successful create) — forwards to /me?tab=submissions, preserving
// the just_submitted query param.

export default async function MySubmissionsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ just_submitted?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  const justSubmitted = sp.just_submitted
  const href = justSubmitted
    ? `/me?tab=submissions&just_submitted=${justSubmitted}`
    : '/me?tab=submissions'
  redirect({ href: href as never, locale: locale as Locale })
}
