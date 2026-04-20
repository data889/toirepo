'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SubmitFab() {
  const t = useTranslations('submit.fab')
  return (
    <Link
      href="/submit"
      className={cn(
        buttonVariants({ variant: 'default', size: 'lg' }),
        'fixed right-4 bottom-6 z-40 px-4 shadow-lg md:right-6 md:bottom-8',
      )}
      style={{
        backgroundColor: 'var(--color-accent-coral, #D4573A)',
        color: '#FDFCF9',
      }}
      aria-label={t('label')}
    >
      <Plus className="mr-1 h-5 w-5" />
      {t('label')}
    </Link>
  )
}
