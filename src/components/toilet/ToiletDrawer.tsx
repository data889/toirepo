'use client'

import { useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button, buttonVariants } from '@/components/ui/button'
import { api } from '@/lib/trpc/client'
import { Link } from '@/i18n/navigation'
import { resolveToiletAddress, resolveToiletName } from '@/lib/map/toilet-labels'

// Locale-key narrowing: messages use zh / ja / en; routing uses zh-CN.
function localeToKey(locale: string): 'zh' | 'ja' | 'en' {
  if (locale === 'zh-CN') return 'zh'
  if (locale === 'ja') return 'ja'
  return 'en'
}

// matchMedia subscription via React's external-store API. Avoids the
// "synchronous setState in useEffect" footgun of the useState+useEffect
// pattern by exposing a stable subscribe + getSnapshot pair.
const MOBILE_QUERY = '(max-width: 767px)'

function subscribeMatchMedia(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(MOBILE_QUERY)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function getMatchMediaSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches
}

function getMatchMediaServerSnapshot(): boolean {
  // Default to desktop layout on the server — mismatched bedtimes are
  // resolved on the client side without a flash because the drawer is
  // closed by default.
  return false
}

function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMatchMedia,
    getMatchMediaSnapshot,
    getMatchMediaServerSnapshot,
  )
}

const TYPE_LABEL: Record<string, { zh: string; ja: string; en: string }> = {
  PUBLIC: { zh: '公共', ja: '公共', en: 'Public' },
  MALL: { zh: '商场', ja: 'モール', en: 'Mall' },
  KONBINI: { zh: '便利店', ja: 'コンビニ', en: 'Konbini' },
  PURCHASE: { zh: '需消费', ja: '要購入', en: 'Purchase' },
}

const TYPE_COLOR: Record<string, string> = {
  PUBLIC: '#D4573A',
  MALL: '#2C6B8F',
  KONBINI: '#5C8A3A',
  PURCHASE: '#B8860B',
}

export interface ToiletDrawerProps {
  slug: string | null
  onClose: () => void
}

export function ToiletDrawer({ slug, onClose }: ToiletDrawerProps) {
  const locale = useLocale()
  const t = useTranslations('toilet.drawer')

  const query = api.toilet.getBySlug.useQuery(
    { slug: slug ?? '' },
    { enabled: !!slug, staleTime: 60 * 1000 },
  )
  const toilet = query.data

  // Viewport detection via useSyncExternalStore — bottom sheet on mobile
  // (< md), right drawer on wider screens. SSR snapshot is `false`
  // (matches the desktop default); on hydration the client snapshot
  // takes over without an extra render.
  const isMobile = useIsMobile()

  const side = isMobile ? 'bottom' : 'right'
  const isOpen = !!slug
  const localeKey = localeToKey(locale)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={side}
        className={
          side === 'bottom'
            ? 'bg-paper max-h-[80vh] overflow-y-auto rounded-t-xl'
            : 'bg-paper w-full overflow-y-auto sm:max-w-md'
        }
      >
        {query.isLoading && (
          <div className="text-ink-secondary py-8 text-center text-sm">{t('loading')}</div>
        )}

        {query.isError && (
          <div className="text-ink-secondary py-8 text-center text-sm">{t('error')}</div>
        )}

        {toilet && (
          <>
            <SheetHeader className="space-y-2">
              <div
                className="inline-flex w-fit items-center gap-1 self-start rounded px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: TYPE_COLOR[toilet.type] ?? '#8A8578',
                  color: '#FDFCF9',
                }}
              >
                {TYPE_LABEL[toilet.type]?.[localeKey] ?? toilet.type}
              </div>
              <SheetTitle className="text-ink-primary text-left text-xl font-medium">
                {resolveToiletName(toilet, locale)}
              </SheetTitle>
              <SheetDescription className="text-ink-secondary text-left text-sm">
                {resolveToiletAddress(toilet, locale)}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4 px-6">
              <div className="text-ink-secondary text-sm">
                <p>{t('descriptionPlaceholder')}</p>
              </div>

              <div className="flex gap-2 pt-4">
                <Link href={`/t/${toilet.slug}`} className={buttonVariants({ variant: 'default' })}>
                  {t('viewDetails')}
                </Link>
                <Button variant="outline" onClick={onClose}>
                  {t('close')}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
