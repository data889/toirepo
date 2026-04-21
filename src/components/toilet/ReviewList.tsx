'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBatchPhotoUrls } from '@/hooks/useBatchPhotoUrls'
import { ReviewItem } from './ReviewItem'

// Paginated approved-review list. Uses cursor-based useInfiniteQuery
// over review.listByToilet so "Load more" appends in place rather
// than replacing the visible window.

export interface ReviewListProps {
  toiletId: string
  /** Page size; default 5. Caller can bump to 10 for /t/[slug] detail. */
  pageSize?: number
}

export function ReviewList({ toiletId, pageSize = 5 }: ReviewListProps) {
  const t = useTranslations('toilet.review')

  const query = api.review.listByToilet.useInfiniteQuery(
    { toiletId, limit: pageSize },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 30 * 1000,
    },
  )

  const reviews = useMemo(() => query.data?.pages.flatMap((p) => p.reviews) ?? [], [query.data])

  // Batch all photo URLs across the whole list in one signed call.
  const allKeys = useMemo(() => reviews.flatMap((r) => r.photoKeys), [reviews])
  const { urls } = useBatchPhotoUrls(allKeys)

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (reviews.length === 0) {
    return <p className="text-ink-tertiary py-3 text-center text-sm">{t('empty')}</p>
  }

  return (
    <div>
      <ul className="space-y-0">
        {reviews.map((r) => (
          <li key={r.id}>
            <ReviewItem review={r} photoUrls={urls} />
          </li>
        ))}
      </ul>

      {query.hasNextPage && (
        <div className="pt-3 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
