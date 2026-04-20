'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { Check, X } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { useBatchPhotoUrls } from '@/hooks/useBatchPhotoUrls'
import { resolveToiletAddress, resolveToiletName } from '@/lib/map/toilet-labels'

type QueueFilter = 'ALL' | 'AI_APPROVED' | 'AI_NEEDS_HUMAN' | 'NO_MODERATION'
type QueueSort = 'newest' | 'oldest' | 'highest_confidence' | 'lowest_confidence'

const DECISION_COLOR: Record<string, string> = {
  APPROVED: '#5C8A3A',
  REJECTED: '#D4573A',
  NEEDS_HUMAN: '#4198AC',
}

const TYPE_COLOR: Record<string, string> = {
  PUBLIC: '#D4573A',
  MALL: '#2C6B8F',
  KONBINI: '#5C8A3A',
  PURCHASE: '#B8860B',
}

export function AdminQueueList() {
  const t = useTranslations('admin.queue')
  const tType = useTranslations('toilet.type')
  const locale = useLocale()

  const [filter, setFilter] = useState<QueueFilter>('ALL')
  const [sortBy, setSortBy] = useState<QueueSort>('newest')

  const utils = api.useUtils()
  const queueQuery = api.admin.listQueue.useQuery({ filter, sortBy }, { staleTime: 30 * 1000 })
  const reviewMutation = api.admin.review.useMutation({
    onSuccess: () => {
      void utils.admin.listQueue.invalidate()
    },
  })

  const items = queueQuery.data ?? []

  const allThumbnailKeys = items.flatMap((it) => it.photos.map((p) => p.thumbnailUrl))
  const { urls: thumbUrls } = useBatchPhotoUrls(allThumbnailKeys)

  async function handleApprove(toiletId: string) {
    await reviewMutation.mutateAsync({ toiletId, action: 'APPROVE' })
  }
  async function handleReject(toiletId: string) {
    await reviewMutation.mutateAsync({ toiletId, action: 'REJECT' })
  }

  return (
    <div className="space-y-6">
      {/* Filters + sort */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div>
          <label className="text-ink-secondary mr-2">{t('filter')}:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as QueueFilter)}
            className="border-border-soft bg-paper rounded border px-2 py-1"
          >
            <option value="ALL">{t('filterAll')}</option>
            <option value="AI_APPROVED">{t('filterAiApproved')}</option>
            <option value="AI_NEEDS_HUMAN">{t('filterAiNeedsHuman')}</option>
            <option value="NO_MODERATION">{t('filterNoModeration')}</option>
          </select>
        </div>
        <div>
          <label className="text-ink-secondary mr-2">{t('sort')}:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as QueueSort)}
            className="border-border-soft bg-paper rounded border px-2 py-1"
          >
            <option value="newest">{t('sortNewest')}</option>
            <option value="oldest">{t('sortOldest')}</option>
            <option value="highest_confidence">{t('sortHighConfidence')}</option>
            <option value="lowest_confidence">{t('sortLowConfidence')}</option>
          </select>
        </div>
        <div className="text-ink-tertiary ml-auto text-xs">
          {t('totalItems', { count: items.length })}
        </div>
      </div>

      {queueQuery.isLoading && (
        <div className="text-ink-secondary py-8 text-center">{t('loading')}</div>
      )}

      {queueQuery.isError && (
        <div className="py-8 text-center text-sm text-[var(--color-accent-coral,#D4573A)]">
          {queueQuery.error.message}
        </div>
      )}

      {!queueQuery.isLoading && items.length === 0 && (
        <div className="border-border-soft rounded border border-dashed p-12 text-center">
          <p className="text-ink-primary text-lg font-medium">{t('empty')}</p>
          <p className="text-ink-secondary mt-2 text-sm">{t('emptyHint')}</p>
        </div>
      )}

      <ul className="space-y-6">
        {items.map((item) => {
          const typeKey = item.type.toLowerCase()
          const typeColor = TYPE_COLOR[item.type] ?? '#8A8578'
          const reasons = Array.isArray(item.moderation?.reasons)
            ? item.moderation!.reasons.filter((r): r is string => typeof r === 'string')
            : []

          return (
            <li key={item.id} className="border-border-soft bg-paper rounded border p-5">
              <div className="mb-3 flex flex-wrap items-start gap-2">
                <span
                  className="rounded px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: typeColor, color: '#FDFCF9' }}
                >
                  {tType(typeKey)}
                </span>
                {item.moderation ? (
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${DECISION_COLOR[item.moderation.decision]}20`,
                      color: DECISION_COLOR[item.moderation.decision],
                    }}
                  >
                    {t('aiLabel', {
                      decision: item.moderation.decision,
                      percent: (item.moderation.confidence * 100).toFixed(0),
                    })}
                  </span>
                ) : (
                  <span className="text-ink-tertiary bg-paper-deep rounded px-2 py-0.5 text-xs">
                    {t('noAI')}
                  </span>
                )}
                <span className="text-ink-tertiary ml-auto text-xs">
                  {new Date(item.createdAt).toLocaleString(locale)}
                </span>
              </div>

              <h3 className="text-ink-primary text-xl font-medium">
                {resolveToiletName(item, locale) || t('untitled')}
              </h3>
              <p className="text-ink-secondary mt-1 text-sm">
                {resolveToiletAddress(item, locale) || '—'}
              </p>
              <p className="text-ink-tertiary mt-1 font-mono text-xs">
                {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
              </p>
              {item.submittedBy && (
                <p className="text-ink-tertiary mt-2 text-xs">
                  {t('submittedBy')}: {item.submittedBy.email}
                </p>
              )}

              {item.photos.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {item.photos.map((photo) => {
                    const url = thumbUrls[photo.thumbnailUrl]
                    return (
                      <div
                        key={photo.id}
                        className="border-border-soft bg-paper-deep relative aspect-square overflow-hidden rounded border"
                      >
                        {url ? (
                          <Image
                            src={url}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 50vw, 25vw"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="bg-paper-deep h-full w-full animate-pulse" />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {reasons.length > 0 && (
                <div className="border-border-soft bg-paper-deep mt-4 rounded border p-3 text-sm">
                  <p className="text-ink-primary mb-2 font-medium">{t('aiReasons')}</p>
                  <ul className="text-ink-secondary list-disc space-y-1 pl-5 text-xs">
                    {reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <Button
                  onClick={() => handleApprove(item.id)}
                  disabled={reviewMutation.isPending}
                  className="flex-1"
                  style={{ backgroundColor: '#5C8A3A', color: '#FDFCF9' }}
                >
                  <Check className="mr-1 h-4 w-4" />
                  {t('approve')}
                </Button>
                <Button
                  onClick={() => handleReject(item.id)}
                  disabled={reviewMutation.isPending}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="mr-1 h-4 w-4" />
                  {t('reject')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
