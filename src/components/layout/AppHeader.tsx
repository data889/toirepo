import { ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { AdminHeaderLink } from './AdminHeaderLink'
import { AuthStatus } from './AuthStatus'
import { LocaleSwitcher } from './LocaleSwitcher'

// Shared top nav for non-map pages (/submit, /me/submissions, /auth/signin,
// /admin/queue, etc). The home page deliberately does NOT use this —
// its header is a transparent overlay floating on top of the full-bleed
// MapCanvas, and a bordered sticky bar would eat map real estate.

export async function AppHeader() {
  const t = await getTranslations('header')
  return (
    <header className="border-border-soft bg-paper sticky top-0 z-40 border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-ink-primary hover:text-ink-secondary inline-flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>toirepo</span>
          <span className="text-ink-tertiary hidden text-xs sm:inline">· {t('backToMap')}</span>
        </Link>
        <div className="flex items-center gap-3">
          <AdminHeaderLink />
          <AuthStatus />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  )
}
