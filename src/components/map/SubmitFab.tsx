'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

// M10 P2 redesign: circular 56×56 FAB, bottom-left so it doesn't overlap
// MapLibre's GeolocateControl (bottom-right). teal-deep fill with white
// plus icon. 56px > iOS HIG 44px tap target.

export function SubmitFab() {
  const t = useTranslations('toilet.submit')
  return (
    <Link
      href="/submit"
      className="fixed bottom-6 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:bottom-8 md:left-6"
      style={{
        backgroundColor: 'var(--color-teal-deep, #51999F)',
        color: '#FDFCF9',
      }}
      aria-label={t('newToilet')}
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </Link>
  )
}
