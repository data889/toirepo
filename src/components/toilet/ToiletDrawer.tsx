'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from '@/hooks/useSession'
import { track } from '@/lib/analytics/posthog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/trpc/client'
import { Navigation } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { resolveToiletAddress, resolveToiletName } from '@/lib/map/toilet-labels'
import { buildDirectionsUrl, detectMapsProvider } from '@/lib/directions'
import { cn } from '@/lib/utils'
import { AppealDialog } from './AppealDialog'
import { ConfirmationCounter } from './ConfirmationCounter'
import { PhotoGallery } from './PhotoGallery'
import { RatingSummary } from './RatingSummary'
import { ReviewForm } from './ReviewForm'
import { ReviewList } from './ReviewList'
import { ToiletStatusBadge, shouldDisplayStatusBadge } from './ToiletStatusBadge'

// M7 P2.1 sectioned layout. Order top-to-bottom:
//   header (type badge + status warning + name + address)
//   photo gallery (existing PhotoGallery)
//   rating summary (avg + per-bucket bars)
//   confirmation counter (still-exists)
//   review list (paginated)
//   action buttons (write review + report — placeholder until P2.2)

const MOBILE_QUERY = '(max-width: 767px)'

function subscribeMatchMedia(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(MOBILE_QUERY)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function getMatchMediaSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches
}

function getMatchMediaServerSnapshot(): boolean {
  return false
}

function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMatchMedia,
    getMatchMediaSnapshot,
    getMatchMediaServerSnapshot,
  )
}

const TYPE_LABEL_KEY: Record<string, string> = {
  PUBLIC: 'public',
  MALL: 'mall',
  KONBINI: 'konbini',
  PURCHASE: 'purchase',
}

const TYPE_COLOR: Record<string, string> = {
  PUBLIC: '#D4573A',
  MALL: '#2C6B8F',
  KONBINI: '#5C8A3A',
  PURCHASE: '#B8860B',
}

export interface ToiletDrawerProps {
  slug: string | null
  onClose: () => void
}

export function ToiletDrawer({ slug, onClose }: ToiletDrawerProps) {
  const locale = useLocale()
  const t = useTranslations('toilet.drawer')
  const tType = useTranslations('toilet.type')
  const tReview = useTranslations('toilet.review')
  const session = useSession()

  // Parallel queries — toilet metadata + reviews. Confirmation count
  // lives inside ConfirmationCounter so it lazy-fetches per-component.
  const toiletQuery = api.toilet.getBySlug.useQuery(
    { slug: slug ?? '' },
    { enabled: !!slug, staleTime: 60 * 1000 },
  )
  const reviewsQuery = api.review.listByToilet.useQuery(
    { toiletId: toiletQuery.data?.id ?? '', limit: 50 },
    { enabled: !!toiletQuery.data?.id, staleTime: 60 * 1000 },
  )

  const [reviewFormOpen, setReviewFormOpen] = useState(false)
  const [appealDialogOpen, setAppealDialogOpen] = useState(false)

  const isMobile = useIsMobile()
  const side = isMobile ? 'bottom' : 'right'
  const isOpen = !!slug
  const toilet = toiletQuery.data

  // Pre-fill ReviewForm when the user already has an APPROVED review on
  // this toilet. PENDING / REJECTED rows aren't visible in this query
  // (review.listByToilet filters by APPROVED) — those callers will
  // re-enter their text. Acceptable for MVP; full edit-PENDING UX is P2.3.
  const myReview = session.user
    ? reviewsQuery.data?.reviews.find((r) => r.user.id === session.user!.id)
    : undefined

  // M10 P1 analytics: fire toilet_viewed once per toilet open. Drawer
  // mounts persistently, so guard on toilet.id changing.
  useEffect(() => {
    if (toilet) {
      track('toilet_viewed', {
        toiletId: toilet.id,
        type: toilet.type,
        status: toilet.status,
      })
    }
  }, [toilet?.id, toilet?.status, toilet?.type, toilet])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={side}
        className={
          side === 'bottom'
            ? 'bg-paper max-h-[80vh] overflow-y-auto rounded-t-xl'
            : 'bg-paper w-full overflow-y-auto sm:max-w-md'
        }
      >
        {toiletQuery.isLoading && <DrawerSkeleton title={t('loading')} />}

        {toiletQuery.isError && (
          <div className="text-ink-secondary py-8 text-center text-sm">{t('error')}</div>
        )}

        {toilet && (
          <div className={cn(shouldDisplayStatusBadge(toilet.status) && 'opacity-70')}>
            <SheetHeader className="space-y-2 pr-6">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex w-fit items-center gap-1 self-start rounded px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: TYPE_COLOR[toilet.type] ?? '#8A8578',
                    color: '#FDFCF9',
                  }}
                >
                  {tType(TYPE_LABEL_KEY[toilet.type] ?? 'public')}
                </span>
                <ToiletStatusBadge status={toilet.status} osmId={toilet.osmId} />
              </div>
              <SheetTitle className="text-ink-primary text-left text-xl font-medium">
                {resolveToiletName(toilet, locale)}
              </SheetTitle>
              <SheetDescription className="text-ink-secondary text-left text-sm">
                {resolveToiletAddress(toilet, locale)}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4 px-6 pb-6">
              {toilet.photos && toilet.photos.length > 0 && (
                <>
                  <PhotoGallery photos={toilet.photos} />
                  <Separator />
                </>
              )}

              <section aria-label={tReview('avgRating')}>
                {reviewsQuery.isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <RatingSummary
                    ratings={(reviewsQuery.data?.reviews ?? []).map((r) => r.rating)}
                  />
                )}
              </section>

              <Separator />

              <ConfirmationCounter toiletId={toilet.id} />

              <Separator />

              <section aria-label="Reviews">
                <h3 className="text-ink-primary mb-2 text-sm font-medium">
                  {tReview('totalCount', { count: reviewsQuery.data?.reviews.length ?? 0 })}
                </h3>
                <ReviewList toiletId={toilet.id} pageSize={5} />
              </section>

              <Separator />

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    // Derive provider at click time so we never touch
                    // navigator during SSR / module evaluation.
                    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
                    const url = buildDirectionsUrl(
                      { latitude: toilet.latitude, longitude: toilet.longitude },
                      detectMapsProvider(ua),
                    )
                    // iOS Safari handles maps:// via the OS; every
                    // other browser opens the Google Maps web URL.
                    // _blank keeps the map tab alive behind it.
                    window.open(url, '_blank', 'noopener,noreferrer')
                  }}
                  style={{
                    backgroundColor: 'var(--color-teal-blue, #4198AC)',
                    color: '#FDFCF9',
                  }}
                >
                  <Navigation className="mr-1 h-4 w-4" />
                  {tReview('navigate')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setReviewFormOpen(true)}>
                  {tReview('writeReview')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAppealDialogOpen(true)}>
                  {tReview('reportIssue')}
                </Button>
                <Link
                  href={`/t/${toilet.slug}`}
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  {t('viewDetails')}
                </Link>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
      {toilet && reviewFormOpen && (
        // Conditional mount on `open` — gives us a fresh form instance
        // each time so state initializes from `existing` without an
        // effect-based reset (lint: react-hooks/set-state-in-effect).
        <ReviewForm
          toiletId={toilet.id}
          open={reviewFormOpen}
          onClose={() => setReviewFormOpen(false)}
          existing={
            myReview
              ? { rating: myReview.rating, body: myReview.body, photoKeys: myReview.photoKeys }
              : undefined
          }
        />
      )}
      {toilet && appealDialogOpen && (
        <AppealDialog
          open={appealDialogOpen}
          onClose={() => setAppealDialogOpen(false)}
          toilet={{
            id: toilet.id,
            status: toilet.status,
            submittedById: toilet.submittedById ?? null,
            name: toilet.name,
            address: toilet.address,
            type: toilet.type,
            floor: toilet.floor ?? null,
          }}
        />
      )}
    </Sheet>
  )
}

function DrawerSkeleton({ title }: { title: string }) {
  return (
    <div className="space-y-4 p-6" aria-label={title}>
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
