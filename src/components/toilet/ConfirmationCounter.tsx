'use client'

import { useTranslations } from 'next-intl'
import { ThumbsUp } from 'lucide-react'
import { TRPCClientError } from '@trpc/client'
import { toast } from 'sonner'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/hooks/useSession'
import { useRouter, usePathname } from '@/i18n/navigation'
import { track } from '@/lib/analytics/posthog'

// "X people confirmed this still works" + a toggle button.
// P2.2: wired to api.confirmation.toggle with optimistic update.
// On click we update React Query's cached count immediately, then
// roll back if the server rejects.

export interface ConfirmationCounterProps {
  toiletId: string
}

export function ConfirmationCounter({ toiletId }: ConfirmationCounterProps) {
  const t = useTranslations('toilet.confirmation')
  const session = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const utils = api.useUtils()

  const query = api.confirmation.countByToilet.useQuery({ toiletId }, { staleTime: 30 * 1000 })

  const toggle = api.confirmation.toggle.useMutation({
    // Optimistic flip — React Query's onMutate gives us the previous
    // snapshot so we can revert if the server rejects (auth / rate
    // limit / FORBIDDEN). Calling cancel() first prevents a midflight
    // refetch from clobbering the optimistic state.
    onMutate: async () => {
      await utils.confirmation.countByToilet.cancel({ toiletId })
      const prev = utils.confirmation.countByToilet.getData({ toiletId })
      utils.confirmation.countByToilet.setData({ toiletId }, (old) => {
        if (!old) return old
        const wasSelfConfirmed = old.selfConfirmed
        return {
          count: old.count + (wasSelfConfirmed ? -1 : 1),
          selfConfirmed: !wasSelfConfirmed,
        }
      })
      // Fire analytics on the optimistic state — server roundtrip
      // doesn't change the user-intent we want to capture
      track('confirmation_toggled', {
        toiletId,
        confirmed: !(prev?.selfConfirmed ?? false),
      })
      return { prev }
    },
    onError: (err, _input, context) => {
      if (context?.prev) {
        utils.confirmation.countByToilet.setData({ toiletId }, context.prev)
      }
      const code = err instanceof TRPCClientError ? (err.data?.code ?? 'UNKNOWN') : 'UNKNOWN'
      if (code === 'UNAUTHORIZED') {
        toast.error(t('errorUnauthorized'))
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}` as never)
      } else if (code === 'TOO_MANY_REQUESTS') {
        toast.error(t('errorTooFrequent'))
      } else {
        toast.error(t('errorGeneric'))
      }
    },
    onSettled: () => {
      // Sync with the server's authoritative count once it's done.
      void utils.confirmation.countByToilet.invalidate({ toiletId })
    },
  })

  if (query.isLoading) {
    return <Skeleton className="h-9 w-full" />
  }

  const count = query.data?.count ?? 0
  const selfConfirmed = query.data?.selfConfirmed ?? false
  const isAuthenticated = session.status === 'authenticated'

  function handleClick() {
    // Anonymous users: route to signin without an optimistic flash so
    // they don't see a phantom +1 they can't actually keep.
    if (!isAuthenticated) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}` as never)
      return
    }
    toggle.mutate({ toiletId })
  }

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
        onClick={handleClick}
        disabled={toggle.isPending}
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
