'use client'

import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { api } from '@/lib/trpc/client'
import { cn } from '@/lib/utils'

// Three-tab horizontal nav for /me. Each tab carries the current
// PENDING-ish count (submissions: total / reviews: total / appeals:
// total — not just PENDING, since users want to see their full
// history at a glance).

export type MeTab = 'submissions' | 'reviews' | 'appeals'

interface MeTabsNavProps {
  active: MeTab
}

export function MeTabsNav({ active }: MeTabsNavProps) {
  const t = useTranslations('me.tabs')
  const params = useSearchParams()
  const carriedQuery = params.get('just_submitted')

  const submissionsQuery = api.submission.listMine.useQuery(
    { limit: 100 },
    { staleTime: 30 * 1000 },
  )
  const reviewsQuery = api.review.listMine.useQuery(undefined, { staleTime: 30 * 1000 })
  const appealsQuery = api.appeal.listMine.useQuery(undefined, { staleTime: 30 * 1000 })

  const tabs: { tab: MeTab; count: number | null }[] = [
    { tab: 'submissions', count: submissionsQuery.data?.length ?? null },
    { tab: 'reviews', count: reviewsQuery.data?.length ?? null },
    { tab: 'appeals', count: appealsQuery.data?.length ?? null },
  ]

  return (
    <nav className="border-border-soft mb-6 flex flex-wrap gap-1 border-b">
      {tabs.map(({ tab, count }) => {
        const isActive = active === tab
        const href =
          tab === 'submissions' && carriedQuery
            ? (`/me?tab=submissions&just_submitted=${carriedQuery}` as never)
            : (`/me?tab=${tab}` as never)
        return (
          <Link
            key={tab}
            href={href}
            className={cn(
              'border-b-2 px-3 py-2 text-sm transition-colors',
              isActive
                ? 'text-ink-primary border-[rgb(81_153_159)] font-medium'
                : 'text-ink-secondary hover:text-ink-primary border-transparent',
            )}
          >
            {t(tab)}
            {count !== null && (
              <span className="text-ink-tertiary ml-1.5 text-xs tabular-nums">({count})</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
