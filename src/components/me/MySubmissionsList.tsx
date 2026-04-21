'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api } from '@/lib/trpc/client'
import { useBatchPhotoUrls } from '@/hooks/useBatchPhotoUrls'
import { useSession } from '@/hooks/useSession'
import { resolveToiletAddress, resolveToiletName } from '@/lib/map/toilet-labels'
import { AppealDialog } from '@/components/toilet/AppealDialog'

// Colors pinned to SPEC §4.2. STATUS covers the 5 real enum values in
// prisma/schema.prisma (PENDING/APPROVED/REJECTED/HIDDEN/ARCHIVED).
// NEEDS_REVISION is not in the schema; if M6 needs that affordance it's
// a separate migration.
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#D68F2E',
  APPROVED: '#5C8A3A',
  REJECTED: '#D4573A',
  HIDDEN: '#8A8578',
  ARCHIVED: '#8A8578',
}

const TYPE_COLOR: Record<string, string> = {
  PUBLIC: '#D4573A',
  MALL: '#2C6B8F',
  KONBINI: '#5C8A3A',
  PURCHASE: '#B8860B',
}

interface MySubmissionsListProps {
  justSubmittedSlug: string | null
}

type AppealableSubmission = {
  id: string
  status: string
  submittedById: string | null
  name: unknown
  address: unknown
  type: 'PUBLIC' | 'MALL' | 'KONBINI' | 'PURCHASE'
  floor: string | null
}

export function MySubmissionsList({ justSubmittedSlug }: MySubmissionsListProps) {
  const t = useTranslations('submissions')
  const tType = useTranslations('toilet.type')
  const locale = useLocale()
  const session = useSession()

  const listQuery = api.submission.listMine.useQuery({ limit: 50 }, { staleTime: 30 * 1000 })

  // M7 P2.3: REJECTED row "Appeal" button opens AppealDialog with
  // initialType=OWN_SUBMISSION_REJECT. Using state instead of per-row
  // mounting keeps a single dialog instance + makes the conditional
  // mount pattern (introduced in P2.2 to avoid set-state-in-effect)
  // straightforward.
  const [appealingSubmission, setAppealingSubmission] = useState<AppealableSubmission | null>(null)
  const trustLevel = session.user?.trustLevel ?? 0
  const canAppeal = trustLevel >= 1

  // Flatten every submission's photo thumbnail keys for one batched
  // presigned-URL call. Dedup happens inside useBatchPhotoUrls.
  const allThumbnailKeys =
    listQuery.data?.flatMap((sub) => sub.photos.map((p) => p.thumbnailUrl)) ?? []
  const { urls: thumbUrls } = useBatchPhotoUrls(allThumbnailKeys)

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

  const submissions = listQuery.data ?? []

  return (
    <div className="space-y-6">
      {justSubmittedSlug && (
        <div className="rounded border border-[#5C8A3A] bg-[#5C8A3A]/10 px-4 py-3 text-sm text-[#5C8A3A]">
          {t('justSubmitted')}
        </div>
      )}

      {submissions.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-4">
          {submissions.map((sub) => {
            const name = resolveToiletName(sub, locale) || t('untitled')
            const address = resolveToiletAddress(sub, locale)
            const typeKey = sub.type.toLowerCase()
            const typeColor = TYPE_COLOR[sub.type] ?? '#8A8578'
            const statusColor = STATUS_COLOR[sub.status] ?? '#8A8578'

            return (
              <li key={sub.id} className="border-border-soft bg-paper rounded border p-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: typeColor, color: '#FDFCF9' }}
                    >
                      {tType(typeKey)}
                    </span>
                    <span
                      className="rounded px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                    >
                      {t(`status.${sub.status}`)}
                    </span>
                  </div>

                  <h3 className="text-ink-primary text-lg font-medium">{name}</h3>
                  {address && <p className="text-ink-secondary text-sm">{address}</p>}
                  <p className="text-ink-tertiary font-mono text-xs">
                    {t('coordinates', {
                      lat: sub.latitude.toFixed(5),
                      lng: sub.longitude.toFixed(5),
                    })}
                  </p>
                  <p className="text-ink-tertiary text-xs">
                    {t('submittedAt', {
                      date: new Date(sub.createdAt).toLocaleDateString(locale),
                    })}
                  </p>
                </div>

                {sub.status === 'REJECTED' && sub.moderation && (
                  <RejectionReasons reasons={sub.moderation.reasons} />
                )}

                {sub.status === 'REJECTED' && (
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canAppeal}
                      title={!canAppeal ? t('appealRequireTrust') : undefined}
                      onClick={() =>
                        setAppealingSubmission({
                          id: sub.id,
                          status: sub.status,
                          submittedById: sub.submittedById,
                          name: sub.name,
                          address: sub.address,
                          type: sub.type,
                          floor: sub.floor ?? null,
                        })
                      }
                    >
                      {t('appealButton')}
                    </Button>
                  </div>
                )}

                {sub.photos.length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {sub.photos.slice(0, 4).map((photo) => {
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
              </li>
            )
          })}
        </ul>
      )}

      {appealingSubmission && (
        <AppealDialog
          open={!!appealingSubmission}
          onClose={() => setAppealingSubmission(null)}
          toilet={appealingSubmission}
          initialType="OWN_SUBMISSION_REJECT"
        />
      )}
    </div>
  )
}

function RejectionReasons({ reasons }: { reasons: unknown }) {
  const t = useTranslations('submissions')
  // Prisma Json? types come back as `JsonValue | null`; narrow to string[]
  // before rendering. Unknown shapes fall back to silent skip so a
  // malformed DB row doesn't crash the whole list.
  const list = Array.isArray(reasons)
    ? reasons.filter((r): r is string => typeof r === 'string')
    : []
  if (list.length === 0) return null
  return (
    <div
      className="mt-3 rounded border border-[var(--color-accent-coral,#D4573A)] bg-[var(--color-accent-coral,#D4573A)]/10 p-3 text-sm"
      role="alert"
    >
      <p className="text-ink-primary mb-1 font-medium">{t('rejectedByAI')}</p>
      <ul className="text-ink-secondary list-disc space-y-1 pl-5 text-xs">
        {list.map((reason, i) => (
          <li key={i}>{reason}</li>
        ))}
      </ul>
    </div>
  )
}

function EmptyState() {
  const t = useTranslations('submissions.empty')
  return (
    <div className="border-border-soft rounded border border-dashed p-8 text-center">
      <h2 className="text-ink-primary text-lg font-medium">{t('heading')}</h2>
      <p className="text-ink-secondary mt-2 text-sm">{t('body')}</p>
      <Link href="/" className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'mt-4')}>
        {t('cta')}
      </Link>
    </div>
  )
}
