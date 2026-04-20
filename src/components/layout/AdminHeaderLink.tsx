import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { auth } from '@/server/auth'

// Server Component — reads the session directly via auth() and renders
// null for non-admins. Avoids the need for a client-side SessionProvider
// (see src/server/auth.ts note): the home page is already a Server
// Component, so dropping this in line costs one extra await and zero
// new plumbing.

export async function AdminHeaderLink() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return null

  const t = await getTranslations('admin')
  return (
    <Link
      href="/admin/queue"
      className="text-ink-secondary hover:text-ink-primary text-sm underline underline-offset-4 hover:no-underline"
    >
      {t('headerLink')}
    </Link>
  )
}
