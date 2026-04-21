'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { api } from '@/lib/trpc/client'
import { resolveToiletName } from '@/lib/map/toilet-labels'

type AppealType =
  | 'OWN_SUBMISSION_REJECT'
  | 'SELF_SOFT_DELETE'
  | 'REPORT_CLOSED'
  | 'REPORT_NO_TOILET'
  | 'REPORT_DATA_ERROR'
  | 'SUGGEST_EDIT'

const TYPE_BADGE_COLOR: Record<AppealType, string> = {
  REPORT_NO_TOILET: '#D4573A',
  REPORT_CLOSED: '#B8860B',
  SUGGEST_EDIT: '#2C6B8F',
  REPORT_DATA_ERROR: '#8A8578',
  OWN_SUBMISSION_REJECT: '#5C8A3A',
  SELF_SOFT_DELETE: '#C5432A',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#D68F2E',
  UPHELD: '#5C8A3A',
  DISMISSED: '#D4573A',
}

export function MyAppealsList() {
  const t = useTranslations('me.appeals')
  const tAdminAppeals = useTranslations('admin.appeals')
  const locale = useLocale()

  const listQuery = api.appeal.listMine.useQuery(undefined, { staleTime: 30 * 1000 })

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

  const appeals = listQuery.data ?? []

  if (appeals.length === 0) {
    return (
      <div className="border-border-soft rounded border border-dashed p-8 text-center">
        <p className="text-ink-primary text-lg font-medium">{t('emptyHeading')}</p>
        <p className="text-ink-secondary mt-2 text-sm">{t('emptyBody')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-4">
      {appeals.map((ap) => {
        const type = ap.type as AppealType
        const typeColor = TYPE_BADGE_COLOR[type] ?? '#8A8578'
        const statusColor = STATUS_COLOR[ap.status] ?? '#8A8578'
        const proposed = ap.proposedChanges as Record<string, unknown> | null
        const reasonExcerpt = ap.reason.length > 80 ? ap.reason.slice(0, 80) + '…' : ap.reason

        return (
          <li key={ap.id} className="border-border-soft bg-paper rounded border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: typeColor, color: '#FDFCF9' }}
              >
                {tAdminAppeals(`type.${type}.shortLabel`)}
              </span>
              <span
                className="rounded px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
              >
                {t(`status.${ap.status}`)}
              </span>
              <span className="text-ink-tertiary ml-auto text-xs">
                {new Date(ap.createdAt).toLocaleDateString(locale)}
              </span>
            </div>

            {ap.targetToilet ? (
              <Link
                href={`/t/${ap.targetToilet.slug}`}
                className="text-ink-primary hover:text-ink-secondary mt-2 inline-block text-base font-medium"
              >
                {resolveToiletName(ap.targetToilet, locale) || t('untitledToilet')}
              </Link>
            ) : (
              <p className="text-ink-tertiary mt-2 text-sm italic">{t('targetMissing')}</p>
            )}

            <p className="text-ink-secondary mt-2 text-sm whitespace-pre-wrap">{reasonExcerpt}</p>

            {/* SUGGEST_EDIT + UPHELD: show that the diff was applied */}
            {type === 'SUGGEST_EDIT' && ap.status === 'UPHELD' && proposed && (
              <p className="text-ink-tertiary mt-2 text-xs">
                {t('upheldEditApplied', {
                  fields: Object.keys(proposed).join(', '),
                })}
              </p>
            )}

            {/* Resolution from admin */}
            {ap.status !== 'PENDING' && ap.resolutionNote && (
              <div className="bg-paper-deep mt-3 rounded p-2 text-xs">
                <p className="text-ink-tertiary mb-1 font-medium">
                  {t('adminNoteHeader', {
                    date: ap.resolvedAt ? new Date(ap.resolvedAt).toLocaleDateString(locale) : '—',
                  })}
                </p>
                <p className="text-ink-primary whitespace-pre-wrap">{ap.resolutionNote}</p>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
