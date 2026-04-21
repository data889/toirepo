'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// Tiny per-user badge shown next to the author's name in review cards.
// L0 / L1 render NULL — no badge for everyday users (avoids the
// "almost everyone has a badge" dilution).
//
// L2 — sky-soft "✓ 验证"
// L3 — amber "★ 资深"

export function shouldShowTrustBadge(level: number): boolean {
  return level >= 2
}

export interface TrustBadgeProps {
  level: number
  className?: string
}

export function TrustBadge({ level, className }: TrustBadgeProps) {
  const t = useTranslations('toilet.trust')
  if (!shouldShowTrustBadge(level)) return null

  if (level === 2) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
          className,
        )}
        style={{
          backgroundColor: 'rgb(123 192 205 / 0.18)', // sky-soft
          color: 'rgb(50 110 130)',
        }}
        title={t('verified')}
      >
        ✓ {t('verified')}
      </span>
    )
  }

  // level >= 3
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
        className,
      )}
      style={{
        backgroundColor: 'rgb(236 182 106 / 0.22)', // amber
        color: 'rgb(150 105 30)',
      }}
      title={t('senior')}
    >
      ★ {t('senior')}
    </span>
  )
}
