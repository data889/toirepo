'use client'

import { useTranslations } from 'next-intl'
import { ThumbsUp } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// "X people confirmed this still works" + a toggle button.
// P2.1 stops at displaying the count and a placeholder button — the
// real toggle wires up in P2.2 against api.confirmation.toggle.

export interface ConfirmationCounterProps {
  toiletId: string
}

export function ConfirmationCounter({ toiletId }: ConfirmationCounterProps) {
  const t = useTranslations('toilet.confirmation')

  const query = api.confirmation.countByToilet.useQuery({ toiletId }, { staleTime: 30 * 1000 })

  if (query.isLoading) {
    return <Skeleton className="h-9 w-full" />
  }

  const count = query.data?.count ?? 0
  const selfConfirmed = query.data?.selfConfirmed ?? false

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-ink-secondary inline-flex items-center gap-1.5 text-sm">
        <ThumbsUp className="h-4 w-4" aria-hidden="true" />
        <span>{t('count', { count })}</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant={selfConfirmed ? 'default' : 'outline'}
        // P2.2 will replace with the real toggle mutation.
        onClick={() => alert('M7 P2.2 — confirmation.toggle 实装中')}
        style={
          selfConfirmed
            ? { backgroundColor: 'rgb(191 223 210)', color: 'rgb(50 110 90)' } // mint-light
            : undefined
        }
      >
        {selfConfirmed ? t('selfConfirmed') : t('action')}
      </Button>
    </div>
  )
}
