'use client'

import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { api } from '@/lib/trpc/client'
import { cn } from '@/lib/utils'

type LocaleMap = Record<string, string>

function resolveLocalized(field: unknown, locale: string): string {
  if (!field || typeof field !== 'object') return ''
  const map = field as LocaleMap
  if (typeof map[locale] === 'string' && map[locale].length > 0) return map[locale]
  for (const fallback of ['en', 'ja', 'zh-CN']) {
    if (typeof map[fallback] === 'string' && map[fallback].length > 0) return map[fallback]
  }
  return ''
}

export function SubmissionsList() {
  const t = useTranslations('submissions')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const justSubmitted = searchParams.get('just_submitted')

  const submissionsQuery = api.submission.listMine.useQuery(undefined, {
    staleTime: 30 * 1000,
  })

  // Pull thumbnail presigned URLs for every submission's first photo in a
  // single batched call (photo.getViewUrls accepts up to 20 keys).
  const thumbnailKeys =
    submissionsQuery.data?.flatMap((s) => (s.photos[0] ? [s.photos[0].thumbnailUrl] : [])) ?? []

  const viewUrlsQuery = api.photo.getViewUrls.useQuery(
    { keys: thumbnailKeys },
    { enabled: thumbnailKeys.length > 0, staleTime: 30 * 60 * 1000 },
  )

  if (submissionsQuery.isLoading) {
    return <div className="text-ink-secondary text-sm">{t('loading')}</div>
  }
  if (submissionsQuery.error) {
    return (
      <div className="text-sm text-[var(--color-accent-coral,#D4573A)]">
        {t('error')}: {submissionsQuery.error.message}
      </div>
    )
  }

  const rows = submissionsQuery.data ?? []

  return (
    <div className="space-y-4">
      {justSubmitted && (
        <div className="border-accent-sage/40 bg-accent-sage/10 flex items-start gap-3 rounded border p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: '#5C8A3A' }} />
          <div>
            <div className="text-ink-primary font-medium">{t('justSubmittedTitle')}</div>
            <div className="text-ink-secondary mt-1">{t('justSubmittedBody')}</div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-ink-secondary rounded border border-dashed border-[var(--color-border-soft,#D9D3C3)] p-8 text-center text-sm">
          {t('empty')}
          <div className="mt-3">
            <Link
              href="/submit"
              className="text-ink-primary underline underline-offset-4 hover:no-underline"
            >
              {t('submitFirst')}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const name = resolveLocalized(row.name, locale)
            const thumbKey = row.photos[0]?.thumbnailUrl
            const thumbUrl = thumbKey ? viewUrlsQuery.data?.[thumbKey] : undefined
            return (
              <li
                key={row.id}
                className="border-border-soft bg-paper rounded border p-3 transition-colors hover:bg-[var(--color-paper-deep,#F5EFE0)]"
              >
                <div className="flex gap-3">
                  <div className="bg-paper-deep relative h-20 w-20 flex-shrink-0 overflow-hidden rounded">
                    {thumbUrl ? (
                      <Image
                        src={thumbUrl}
                        alt=""
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-ink-tertiary text-xs">—</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-ink-primary truncate text-sm font-medium">
                        {name || t('untitled')}
                      </h3>
                      <StatusBadge status={row.status} />
                    </div>
                    <div className="text-ink-tertiary mt-1 font-mono text-xs">
                      {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                    </div>
                    <div className="text-ink-tertiary mt-1 text-xs">{t(`type.${row.type}`)}</div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('submissions.status')

  let color = '#6E655A'
  let Icon = Clock
  if (status === 'APPROVED') {
    color = '#5C8A3A'
    Icon = CheckCircle2
  } else if (status === 'REJECTED') {
    color = '#D4573A'
    Icon = XCircle
  }

  return (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      )}
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <Icon className="h-3 w-3" />
      {t(status)}
    </span>
  )
}
