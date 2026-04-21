'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
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
import { resolveToiletName, resolveToiletAddress } from '@/lib/map/toilet-labels'
import { TrustBadge } from '@/components/toilet/TrustBadge'

type AppealType =
  | 'OWN_SUBMISSION_REJECT'
  | 'SELF_SOFT_DELETE'
  | 'REPORT_CLOSED'
  | 'REPORT_NO_TOILET'
  | 'REPORT_DATA_ERROR'
  | 'SUGGEST_EDIT'

type FilterValue = 'ALL' | AppealType

const APPEAL_TYPES: AppealType[] = [
  'REPORT_NO_TOILET',
  'REPORT_CLOSED',
  'SUGGEST_EDIT',
  'REPORT_DATA_ERROR',
  'OWN_SUBMISSION_REJECT',
  'SELF_SOFT_DELETE',
]

const TYPE_BADGE_COLOR: Record<AppealType, string> = {
  REPORT_NO_TOILET: '#D4573A',
  REPORT_CLOSED: '#B8860B',
  SUGGEST_EDIT: '#2C6B8F',
  REPORT_DATA_ERROR: '#8A8578',
  OWN_SUBMISSION_REJECT: '#5C8A3A',
  SELF_SOFT_DELETE: '#C5432A',
}

const AI_DECISION_COLOR: Record<string, string> = {
  APPROVED: '#5C8A3A',
  NEEDS_HUMAN: '#4198AC',
  REJECTED: '#D4573A',
}

export function AdminAppealsList() {
  const t = useTranslations('admin.appeals')
  const locale = useLocale()

  const [filterType, setFilterType] = useState<FilterValue>('ALL')
  const [resolving, setResolving] = useState<{
    id: string
    decision: 'UPHELD' | 'DISMISSED'
  } | null>(null)
  const [resolveNote, setResolveNote] = useState('')

  const utils = api.useUtils()
  const queueQuery = api.admin.listAppeals.useQuery(
    { status: 'PENDING', type: filterType === 'ALL' ? undefined : filterType, limit: 30 },
    { staleTime: 30 * 1000 },
  )

  const resolveMutation = api.admin.resolveAppeal.useMutation({
    onSuccess: () => {
      void utils.admin.listAppeals.invalidate()
      // M12: the public map moved off toilet.list to toilet.listByBbox
      // for viewport-scoped fetches; invalidate the bbox key so any
      // open map re-queries its current viewport after an appeal
      // resolution mutates the visible Toilet.
      void utils.toilet.listByBbox.invalidate()
      void utils.toilet.getBySlug.invalidate()
    },
    onError: (err) => {
      const code = err instanceof TRPCClientError ? (err.data?.code ?? 'UNKNOWN') : 'UNKNOWN'
      toast.error(t(`error.${code === 'UNAUTHORIZED' || code === 'FORBIDDEN' ? code : 'generic'}`))
    },
  })

  const appeals = queueQuery.data?.appeals ?? []
  const allEvidenceKeys = appeals.flatMap((a) => a.evidence)
  const { urls } = useBatchPhotoUrls(allEvidenceKeys)

  async function handleConfirmResolve() {
    if (!resolving) return
    await resolveMutation.mutateAsync({
      appealId: resolving.id,
      decision: resolving.decision,
      note: resolveNote.trim() || undefined,
    })
    toast.success(t(resolving.decision === 'UPHELD' ? 'toastUpheld' : 'toastDismissed'))
    setResolving(null)
    setResolveNote('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Label htmlFor="appeal-type-filter" className="text-ink-secondary">
          {t('filterType')}:
        </Label>
        <select
          id="appeal-type-filter"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterValue)}
          className="border-border-soft bg-paper rounded border px-2 py-1"
        >
          <option value="ALL">{t('filterAll')}</option>
          {APPEAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`type.${type}.shortLabel`)}
            </option>
          ))}
        </select>
        <span className="text-ink-tertiary ml-auto text-xs">
          {t('totalItems', { count: appeals.length })}
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
      {!queueQuery.isLoading && appeals.length === 0 && (
        <div className="border-border-soft rounded border border-dashed p-12 text-center">
          <p className="text-ink-primary text-lg font-medium">{t('empty')}</p>
          <p className="text-ink-secondary mt-2 text-sm">{t('emptyHint')}</p>
        </div>
      )}

      <ul className="space-y-5">
        {appeals.map((ap) => {
          const type = ap.type as AppealType
          const typeColor = TYPE_BADGE_COLOR[type] ?? '#8A8578'
          const aiColor = ap.aiDecision ? AI_DECISION_COLOR[ap.aiDecision] : null
          const aiReasons = Array.isArray(ap.aiReasons)
            ? ap.aiReasons.filter((r): r is string => typeof r === 'string')
            : []

          return (
            <li key={ap.id} className="border-border-soft bg-paper rounded border p-5">
              {/* Top: type + AI + date */}
              <div className="mb-3 flex flex-wrap items-start gap-2">
                <span
                  className="rounded px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: typeColor, color: '#FDFCF9' }}
                >
                  {t(`type.${type}.label`)}
                </span>
                {aiColor && ap.aiDecision && (
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${aiColor}20`, color: aiColor }}
                  >
                    {t('aiLabel', {
                      decision: ap.aiDecision,
                      percent: ((ap.aiConfidence ?? 0) * 100).toFixed(0),
                    })}
                  </span>
                )}
                <span className="text-ink-tertiary ml-auto text-xs">
                  {new Date(ap.createdAt).toLocaleString(locale)}
                </span>
              </div>

              {/* Target toilet */}
              {ap.targetToilet ? (
                <>
                  <h3 className="text-ink-primary text-lg font-medium">
                    {resolveToiletName(ap.targetToilet, locale) || t('untitledToilet')}
                  </h3>
                  <p className="text-ink-tertiary text-xs">
                    {t('targetStatus')}: {ap.targetToilet.status}
                  </p>
                </>
              ) : (
                <p className="text-ink-tertiary text-sm italic">{t('targetMissing')}</p>
              )}

              {/* Appellant */}
              <div className="text-ink-tertiary mt-1 flex items-center gap-1.5 text-xs">
                <span>{ap.user.name ?? ap.user.email}</span>
                <TrustBadge level={ap.user.trustLevel} />
              </div>

              {/* SUGGEST_EDIT diff */}
              {type === 'SUGGEST_EDIT' && ap.proposedChanges && (
                <SuggestEditDiff
                  proposed={ap.proposedChanges as Record<string, unknown>}
                  current={ap.targetToilet ?? null}
                  locale={locale}
                  t={t}
                />
              )}

              {/* Reason */}
              <div className="bg-paper-deep mt-3 rounded p-3">
                <p className="text-ink-tertiary mb-1 text-xs font-medium">{t('reasonHeader')}</p>
                <p className="text-ink-primary text-sm whitespace-pre-wrap">{ap.reason}</p>
              </div>

              {/* Evidence photos */}
              {ap.evidence.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {ap.evidence.slice(0, 5).map((key) => {
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

              {/* AI reasons (advisory) */}
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

              {/* Action */}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  onClick={() => setResolving({ id: ap.id, decision: 'UPHELD' })}
                  disabled={resolveMutation.isPending}
                  style={{ backgroundColor: '#5C8A3A', color: '#FDFCF9' }}
                  className="flex-1"
                >
                  <Check className="mr-1 h-4 w-4" />
                  {t('uphold')}
                </Button>
                <Button
                  onClick={() => setResolving({ id: ap.id, decision: 'DISMISSED' })}
                  disabled={resolveMutation.isPending}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="mr-1 h-4 w-4" />
                  {t('dismiss')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Resolve note dialog */}
      <Dialog
        open={!!resolving}
        onOpenChange={(open) => {
          if (!open) {
            setResolving(null)
            setResolveNote('')
          }
        }}
      >
        <DialogContent className="bg-paper sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resolving?.decision === 'UPHELD' ? t('upholdDialogTitle') : t('dismissDialogTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="resolve-note" className="text-ink-secondary text-sm">
              {t('resolveNoteLabel')}
            </Label>
            <Textarea
              id="resolve-note"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value.slice(0, 2000))}
              rows={4}
              placeholder={t('resolveNotePlaceholder')}
            />
            <p className="text-ink-tertiary text-right text-xs">{resolveNote.length} / 2000</p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setResolving(null)
                setResolveNote('')
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={() => void handleConfirmResolve()}
              disabled={resolveMutation.isPending}
            >
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface SuggestEditDiffProps {
  proposed: Record<string, unknown>
  current: { name: unknown; address: unknown; type: string; floor: string | null } | null
  locale: string
  t: (key: string) => string
}

function SuggestEditDiff({ proposed, current, locale, t }: SuggestEditDiffProps) {
  const rows: { field: string; oldVal: string; newVal: string }[] = []
  if (typeof proposed.name === 'string') {
    rows.push({
      field: t('diff.name'),
      oldVal: current ? resolveToiletName(current as never, locale) : '—',
      newVal: proposed.name,
    })
  }
  if (typeof proposed.address === 'string') {
    rows.push({
      field: t('diff.address'),
      oldVal: current ? resolveToiletAddress(current as never, locale) : '—',
      newVal: proposed.address,
    })
  }
  if (typeof proposed.type === 'string') {
    rows.push({
      field: t('diff.type'),
      oldVal: current?.type ?? '—',
      newVal: proposed.type,
    })
  }
  if (typeof proposed.floor === 'string') {
    rows.push({
      field: t('diff.floor'),
      oldVal: current?.floor ?? '—',
      newVal: proposed.floor,
    })
  }

  if (rows.length === 0) return null

  return (
    <div className="bg-paper-deep mt-3 space-y-1.5 rounded p-3 text-sm">
      <p className="text-ink-tertiary mb-1 text-xs font-medium">{t('diff.header')}</p>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[80px_1fr] gap-2 text-xs">
          <span className="text-ink-secondary font-medium">{row.field}</span>
          <span>
            <span className="text-ink-tertiary line-through">{row.oldVal || '—'}</span>
            <span className="text-ink-tertiary mx-2">→</span>
            <span className="text-ink-primary font-medium">{row.newVal}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
