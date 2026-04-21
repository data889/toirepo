'use client'

import Image from 'next/image'
import { useLocale } from 'next-intl'
import { StarRating } from './StarRating'
import { TrustBadge } from './TrustBadge'

// One review row inside ReviewList. Stays presentational — the list
// component handles pagination + data fetching.
//
// Photo thumbnails reuse useBatchPhotoUrls so each Review's keys get
// signed in the same batched request as everything else on the page.
// (The list component dedupes upstream.)

export interface ReviewItemReview {
  id: string
  rating: number
  body: string | null
  photoKeys: string[]
  createdAt: Date | string
  user: {
    id: string
    name: string | null
    image: string | null
    trustLevel: number
  }
}

export interface ReviewItemProps {
  review: ReviewItemReview
  /** Resolved view URLs for the photoKeys (parent batched call). */
  photoUrls?: Record<string, string>
}

export function ReviewItem({ review, photoUrls = {} }: ReviewItemProps) {
  const locale = useLocale()
  const dateStr = formatDate(review.createdAt, locale)

  return (
    <article
      className="border-border-soft border-b py-3 last:border-0"
      style={{ backgroundColor: 'rgb(191 223 210 / 0.06)' /* mint-light @6% */ }}
    >
      <header className="flex items-center gap-2">
        <Avatar name={review.user.name} image={review.user.image} />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-ink-primary text-sm font-medium">
              {review.user.name ?? 'Anonymous'}
            </span>
            <TrustBadge level={review.user.trustLevel} />
          </div>
          <span className="text-ink-tertiary text-xs">{dateStr}</span>
        </div>
        <StarRating value={review.rating} size="sm" />
      </header>

      {review.body && (
        <p className="text-ink-primary mt-2 text-sm leading-relaxed whitespace-pre-wrap">
          {review.body}
        </p>
      )}

      {review.photoKeys.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {review.photoKeys.slice(0, 4).map((key) => {
            const url = photoUrls[key]
            return (
              <div
                key={key}
                className="border-border-soft bg-paper-deep relative aspect-square overflow-hidden rounded border"
              >
                {url ? (
                  <Image src={url} alt="" fill sizes="80px" unoptimized className="object-cover" />
                ) : (
                  <div className="bg-paper-deep h-full w-full animate-pulse" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  const initial = (name?.trim()[0] ?? '?').toUpperCase()
  if (image) {
    return (
      <div className="relative h-8 w-8 overflow-hidden rounded-full">
        <Image src={image} alt="" fill sizes="32px" unoptimized className="object-cover" />
      </div>
    )
  }
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: 'rgb(81 153 159)' /* teal-deep */ }}
      aria-hidden="true"
    >
      {initial}
    </div>
  )
}

function formatDate(d: Date | string, locale: string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}
