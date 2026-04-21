'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { api } from '@/lib/trpc/client'
import { cn } from '@/lib/utils'

// Three-tab horizontal nav for the admin moderation surfaces. Each tab
// shows its current PENDING count via the corresponding listXxx query
// (cheap — admin pages are infrequent and 30s staleTime keeps these
// queries from re-firing on every route hop).

interface NavTab {
  href: '/admin/queue' | '/admin/reviews' | '/admin/appeals'
  labelKey: 'queue' | 'reviews' | 'appeals'
  count: number | null
}

export function AdminNav() {
  const t = useTranslations('admin.nav')
  const pathname = usePathname()

  // Counts are best-effort — failures (network, etc.) leave the badge
  // blank rather than blocking nav rendering.
  const queueCount = api.admin.listQueue.useQuery(
    { filter: 'ALL', sortBy: 'newest', limit: 100 },
    { staleTime: 30 * 1000 },
  )
  const reviewsCount = api.admin.listPendingReviews.useQuery(
    { filter: 'ALL', limit: 50 },
    { staleTime: 30 * 1000 },
  )
  const appealsCount = api.admin.listAppeals.useQuery(
    { status: 'PENDING', limit: 50 },
    { staleTime: 30 * 1000 },
  )

  const tabs: NavTab[] = [
    { href: '/admin/queue', labelKey: 'queue', count: queueCount.data?.length ?? null },
    {
      href: '/admin/reviews',
      labelKey: 'reviews',
      count: reviewsCount.data?.reviews.length ?? null,
    },
    {
      href: '/admin/appeals',
      labelKey: 'appeals',
      count: appealsCount.data?.appeals.length ?? null,
    },
  ]

  return (
    <nav className="border-border-soft mb-6 flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'border-b-2 px-3 py-2 text-sm transition-colors',
              isActive
                ? 'text-ink-primary border-[rgb(81_153_159)] font-medium'
                : 'text-ink-secondary hover:text-ink-primary border-transparent',
            )}
          >
            {t(tab.labelKey)}
            {tab.count !== null && (
              <span className="text-ink-tertiary ml-1.5 text-xs tabular-nums">({tab.count})</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
