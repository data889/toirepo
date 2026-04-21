'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Check, EyeOff, X } from 'lucide-react'
import { TRPCClientError } from '@trpc/client'
import { toast } from 'sonner'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBatchPhotoUrls } from '@/hooks/useBatchPhotoUrls'
import { resolveToiletName } from '@/lib/map/toilet-labels'
import { StarRating } from '@/components/toilet/StarRating'
import { TrustBadge } from '@/components/toilet/TrustBadge'

type ReviewFilter = 'ALL' | 'AI_APPROVED' | 'AI_FLAG' | 'AI_REJECT' | 'NO_MODERATION'

const TYPE_COLOR: Record<string, string> = {
  PUBLIC: '#D4573A',
  MALL: '#2C6B8F',
  KONBINI: '#5C8A3A',
  PURCHASE: '#B8860B',
}

const AI_DECISION_COLOR: Record<string, string> = {
  APPROVED: '#5C8A3A',
  NEEDS_HUMAN: '#4198AC',
  REJECTED: '#D4573A',
}

export function AdminReviewsList() {
  const t = useTranslations('admin.reviews')
  const tType = useTranslations('toilet.type')
  const locale = useLocale()

  const [filter, setFilter] = useState<ReviewFilter>('ALL')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const utils = api.useUtils()
  const queueQuery = api.admin.listPendingReviews.useQuery(
    { filter, limit: 30 },
    { staleTime: 30 * 1000 },
  )

  const resolveMutation = api.admin.resolveReview.useMutation({
    onSuccess: () => {
      void utils.admin.listPendingReviews.invalidate()
      void utils.review.listByToilet.invalidate()
    },
    onError: (err) => {
      const code = err instanceof TRPCClientError ? (err.data?.code ?? 'UNKNOWN') : 'UNKNOWN'
      toast.error(t(`error.${code === 'UNAUTHORIZED' || code === 'FORBIDDEN' ? code : 'generic'}`))
    },
  })

  const reviews = queueQuery.data?.reviews ?? []

  // Photo keys are stored on Review.photoKeys (not the Photo table)
  // — keys are R2 originals. Use 80px thumbs since this is a queue view.
  const allKeys = reviews.flatMap((r) => r.photoKeys)
  const { urls } = useBatchPhotoUrls(allKeys)

  async function handleApprove(reviewId: string) {
    await resolveMutation.mutateAsync({ reviewId, decision: 'APPROVED' })
    toast.success(t('toastApproved'))
  }

  async function handleHide(reviewId: string) {
    await resolveMutation.mutateAsync({ reviewId, decision: 'HIDDEN' })
    toast.success(t('toastHidden'))
  }

  async function handleConfirmReject() {
    if (!rejectingId) return
    await resolveMutation.mutateAsync({
      reviewId: rejectingId,
      decision: 'REJECTED',
      note: rejectNote.trim() || undefined,
    })
    toast.success(t('toastRejected'))
    setRejectingId(null)
    setRejectNote('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Label htmlFor="review-filter" className="text-ink-secondary">
          {t('filter')}:
        </Label>
        <select
          id="review-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as ReviewFilter)}
          className="border-border-soft bg-paper rounded border px-2 py-1"
        >
          <option value="ALL">{t('filterAll')}</option>
          <option value="AI_APPROVED">{t('filterAiApproved')}</option>
          <option value="AI_FLAG">{t('filterAiFlag')}</option>
          <option value="AI_REJECT">{t('filterAiReject')}</option>
          <option value="NO_MODERATION">{t('filterNoModeration')}</option>
        </select>
        <span className="text-ink-tertiary ml-auto text-xs">
          {t('totalItems', { count: reviews.length })}
        </span>
      </div>

      {queueQuery.isLoading && (
        <div className="text-ink-secondary py-8 text-center">{t('loading')}</div>
      )}
      {queueQuery.isError && (
        <div className="py-8 text-center text-sm text-[var(--color-accent-coral,#D4573A)]">
          {queueQuery.error.message}
        </div>
      )}
      {!queueQuery.isLoading && reviews.length === 0 && (
        <div className="border-border-soft rounded border border-dashed p-12 text-center">
          <p className="text-ink-primary text-lg font-medium">{t('empty')}</p>
          <p className="text-ink-secondary mt-2 text-sm">{t('emptyHint')}</p>
        </div>
      )}

      <ul className="space-y-5">
        {reviews.map((rv) => {
          const typeColor = TYPE_COLOR[rv.toilet.type] ?? '#8A8578'
          const aiColor = rv.aiDecision ? AI_DECISION_COLOR[rv.aiDecision] : null
          const aiReasons = Array.isArray(rv.aiReasons)
            ? rv.aiReasons.filter((r): r is string => typeof r === 'string')
            : []

          return (
            <li key={rv.id} className="border-border-soft bg-paper rounded border p-5">
              {/* Top: target toilet + AI badge + date */}
              <div className="mb-3 flex flex-wrap items-start gap-2">
                <span
                  className="rounded px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: typeColor, color: '#FDFCF9' }}
                >
                  {tType(rv.toilet.type.toLowerCase())}
                </span>
                {aiColor && rv.aiDecision && (
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${aiColor}20`, color: aiColor }}
                  >
                    {t('aiLabel', {
                      decision: rv.aiDecision,
                      percent: ((rv.aiConfidence ?? 0) * 100).toFixed(0),
                    })}
                  </span>
                )}
                {!rv.aiDecision && (
                  <span className="text-ink-tertiary bg-paper-deep rounded px-2 py-0.5 text-xs">
                    {t('noAI')}
                  </span>
                )}
                <span className="text-ink-tertiary ml-auto text-xs">
                  {new Date(rv.createdAt).toLocaleString(locale)}
                </span>
              </div>

              <h3 className="text-ink-primary text-lg font-medium">
                {resolveToiletName(rv.toilet, locale) || t('untitledToilet')}
              </h3>

              {/* Reviewer */}
              <div className="text-ink-tertiary mt-1 flex items-center gap-1.5 text-xs">
                <span>{rv.user.name ?? rv.user.email}</span>
                <TrustBadge level={rv.user.trustLevel} />
              </div>

              {/* Rating + body */}
              <div className="mt-3 flex items-start gap-3">
                <StarRating value={rv.rating} size="md" />
              </div>
              {rv.body && (
                <p className="text-ink-primary mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                  {rv.body}
                </p>
              )}

              {rv.photoKeys.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {rv.photoKeys.slice(0, 5).map((key) => {
                    const url = urls[key]
                    return (
                      <div
                        key={key}
                        className="border-border-soft bg-paper-deep relative aspect-square overflow-hidden rounded border"
                      >
                        {url ? (
                          <Image
                            src={url}
                            alt=""
                            fill
                            sizes="80px"
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

              {aiReasons.length > 0 && (
                <div className="border-border-soft bg-paper-deep mt-3 rounded border p-3 text-sm">
                  <p className="text-ink-primary mb-1 font-medium">{t('aiReasons')}</p>
                  <ul className="text-ink-secondary list-disc space-y-0.5 pl-5 text-xs">
                    {aiReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  onClick={() => handleApprove(rv.id)}
                  disabled={resolveMutation.isPending}
                  style={{ backgroundColor: '#5C8A3A', color: '#FDFCF9' }}
                  className="flex-1"
                >
                  <Check className="mr-1 h-4 w-4" />
                  {t('approve')}
                </Button>
                <Button
                  onClick={() => setRejectingId(rv.id)}
                  disabled={resolveMutation.isPending}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="mr-1 h-4 w-4" />
                  {t('reject')}
                </Button>
                <Button
                  onClick={() => handleHide(rv.id)}
                  disabled={resolveMutation.isPending}
                  variant="ghost"
                >
                  <EyeOff className="mr-1 h-4 w-4" />
                  {t('hide')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Reject note dialog */}
      <Dialog
        open={!!rejectingId}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingId(null)
            setRejectNote('')
          }
        }}
      >
        <DialogContent className="bg-paper sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('rejectDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reject-note" className="text-ink-secondary text-sm">
              {t('rejectNoteLabel')}
            </Label>
            <Textarea
              id="reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value.slice(0, 500))}
              rows={4}
              placeholder={t('rejectNotePlaceholder')}
            />
            <p className="text-ink-tertiary text-right text-xs">{rejectNote.length} / 500</p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setRejectingId(null)
                setRejectNote('')
              }}
            >
              {t('cancel')}
            </Button>
            <Button onClick={() => void handleConfirmReject()} disabled={resolveMutation.isPending}>
              {t('confirmReject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
