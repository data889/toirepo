'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// Renders a status badge for non-APPROVED toilets. APPROVED is the
// default state and produces no badge — silence is the signal.
//
// Three statuses produce visible warnings:
//   CLOSED         — coral-deep "已关闭"
//   NO_TOILET_HERE — coral-deep "该店实际无厕所"
//   HIDDEN         — sand "隐藏中" (admin-only path; users normally
//                    don't see HIDDEN toilets, but the badge is wired
//                    here for completeness)
//
// PENDING / REJECTED / ARCHIVED never reach this component — toilet.list
// + toilet.getBySlug filter them out server-side.

export const TOILET_STATUS_BADGE_CONFIG = {
  CLOSED: {
    bg: 'rgb(237 141 90 / 0.15)', // coral-deep @15%
    fg: 'rgb(237 141 90)',
    labelKey: 'closed',
  },
  NO_TOILET_HERE: {
    bg: 'rgb(237 141 90 / 0.15)',
    fg: 'rgb(237 141 90)',
    labelKey: 'noToilet',
  },
  HIDDEN: {
    bg: 'rgb(219 203 146 / 0.25)', // sand @25%
    fg: 'rgb(120 105 60)',
    labelKey: 'hidden',
  },
} as const

export type DisplayableToiletStatus = keyof typeof TOILET_STATUS_BADGE_CONFIG

export function shouldDisplayStatusBadge(status: string): status is DisplayableToiletStatus {
  return status in TOILET_STATUS_BADGE_CONFIG
}

export interface ToiletStatusBadgeProps {
  status: string
  osmId?: string | null
  className?: string
}

export function ToiletStatusBadge({ status, osmId, className }: ToiletStatusBadgeProps) {
  const t = useTranslations('toilet')

  if (!shouldDisplayStatusBadge(status)) {
    // APPROVED + any unknown status → render nothing visual.
    // Still surface the OSM source label if present, on its own.
    if (osmId) return <SourceLabel kind="osm" className={className} />
    return null
  }

  const cfg = TOILET_STATUS_BADGE_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className="rounded-md px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: cfg.bg, color: cfg.fg }}
        role="status"
      >
        ⚠️ {t(`status.${cfg.labelKey}`)}
      </span>
      {osmId && <SourceLabel kind="osm" />}
    </span>
  )
}

function SourceLabel({ kind, className }: { kind: 'osm' | 'user'; className?: string }) {
  const t = useTranslations('toilet.source')
  return (
    <span
      data-testid={`source-label-${kind}`}
      className={cn(
        'text-ink-tertiary inline-flex items-center rounded border border-current/30 px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase',
        className,
      )}
    >
      {t(kind)}
    </span>
  )
}
