'use client'

import { useLocale, useTranslations } from 'next-intl'
import { TRPCClientError } from '@trpc/client'
import { toast } from 'sonner'
import { Link } from '@/i18n/navigation'
import { api } from '@/lib/trpc/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { resolveToiletName } from '@/lib/map/toilet-labels'
import { StarRating } from '@/components/toilet/StarRating'
import { cn } from '@/lib/utils'

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#D68F2E',
  APPROVED: '#5C8A3A',
  REJECTED: '#D4573A',
  HIDDEN: '#8A8578',
}

const TYPE_COLOR: Record<string, string> = {
  PUBLIC: '#D4573A',
  MALL: '#2C6B8F',
  KONBINI: '#5C8A3A',
  PURCHASE: '#B8860B',
}

export function MyReviewsList() {
  const t = useTranslations('me.reviews')
  const tType = useTranslations('toilet.type')
  const locale = useLocale()

  const utils = api.useUtils()
  const listQuery = api.review.listMine.useQuery(undefined, { staleTime: 30 * 1000 })

  const deleteMutation = api.review.delete.useMutation({
    onSuccess: () => {
      void utils.review.listMine.invalidate()
      toast.success(t('toastDeleted'))
    },
    onError: (err) => {
      const code = err instanceof TRPCClientError ? (err.data?.code ?? 'UNKNOWN') : 'UNKNOWN'
      toast.error(t(`error.${code === 'UNAUTHORIZED' || code === 'FORBIDDEN' ? code : 'generic'}`))
    },
  })

  if (listQuery.isLoading) {
    return <div className="text-ink-secondary py-8 text-center text-sm">{t('loading')}</div>
  }
  if (listQuery.isError) {
    return (
      <div className="py-8 text-center text-sm text-[var(--color-accent-coral,#D4573A)]">
        {t('loadError')}
      </div>
    )
  }

  const reviews = listQuery.data ?? []

  if (reviews.length === 0) {
    return (
      <div className="border-border-soft rounded border border-dashed p-8 text-center">
        <p className="text-ink-primary text-lg font-medium">{t('emptyHeading')}</p>
        <p className="text-ink-secondary mt-2 text-sm">{t('emptyBody')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-4">
      {reviews.map((rv) => {
        const typeColor = TYPE_COLOR[rv.toilet.type] ?? '#8A8578'
        const statusColor = STATUS_COLOR[rv.status] ?? '#8A8578'
        const aiReasons = Array.isArray(rv.aiReasons)
          ? rv.aiReasons.filter((r): r is string => typeof r === 'string')
          : []

        return (
          <li key={rv.id} className="border-border-soft bg-paper rounded border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: typeColor, color: '#FDFCF9' }}
              >
                {tType(rv.toilet.type.toLowerCase())}
              </span>
              <span
                className="rounded px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
              >
                {t(`status.${rv.status}`)}
              </span>
              <span className="text-ink-tertiary ml-auto text-xs">
                {new Date(rv.createdAt).toLocaleDateString(locale)}
              </span>
            </div>

            <Link
              href={`/t/${rv.toilet.slug}`}
              className="text-ink-primary hover:text-ink-secondary mt-2 inline-block text-base font-medium"
            >
              {resolveToiletName(rv.toilet, locale) || t('untitledToilet')}
            </Link>

            <div className="mt-2 flex items-center gap-2">
              <StarRating value={rv.rating} size="sm" />
            </div>

            {rv.body && (
              <p className="text-ink-primary mt-2 text-sm whitespace-pre-wrap">{rv.body}</p>
            )}

            {/* AI reasons surface for REJECTED — admin reject note is not persisted */}
            {rv.status === 'REJECTED' && aiReasons.length > 0 && (
              <div
                className="mt-3 rounded border border-[var(--color-accent-coral,#D4573A)] bg-[var(--color-accent-coral,#D4573A)]/10 p-2 text-xs"
                role="alert"
              >
                <p className="text-ink-primary mb-1 font-medium">{t('rejectReasonsHeader')}</p>
                <ul className="text-ink-secondary list-disc space-y-0.5 pl-5">
                  {aiReasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              {/* Edit jumps the user to the toilet's drawer where ReviewForm
                  pre-fills via review.listByToilet (works for APPROVED only;
                  PENDING/REJECTED edit is a known limitation today — user
                  would need to delete then re-create). */}
              <Link
                href={`/?t=${rv.toilet.slug}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                {t('view')}
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(t('confirmDelete'))) {
                    void deleteMutation.mutateAsync({ reviewId: rv.id })
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {t('delete')}
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
