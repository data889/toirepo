import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getApi } from '@/lib/trpc/server'
import { Link } from '@/i18n/navigation'
import { resolveToiletAddress, resolveToiletName } from '@/lib/map/toilet-labels'
import { PhotoGallery } from '@/components/toilet/PhotoGallery'

const TYPE_LABEL_KEY: Record<string, string> = {
  PUBLIC: 'toilet.type.public',
  MALL: 'toilet.type.mall',
  KONBINI: 'toilet.type.konbini',
  PURCHASE: 'toilet.type.purchase',
}

const TYPE_COLOR: Record<string, string> = {
  PUBLIC: '#D4573A',
  MALL: '#2C6B8F',
  KONBINI: '#5C8A3A',
  PURCHASE: '#B8860B',
}

export default async function ToiletDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const api = await getApi()
  const toilet = await api.toilet.getBySlug({ slug })

  if (!toilet) {
    notFound()
  }

  const t = await getTranslations()
  const name = resolveToiletName(toilet, locale)
  const address = resolveToiletAddress(toilet, locale)

  return (
    <main className="bg-paper text-ink-primary min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href="/"
          className="text-ink-secondary hover:text-ink-primary mb-6 inline-block text-sm"
        >
          ← {t('toilet.detail.backToMap')}
        </Link>

        <div className="space-y-4">
          <div
            className="inline-block rounded px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: TYPE_COLOR[toilet.type] ?? '#8A8578',
              color: '#FDFCF9',
            }}
          >
            {t(TYPE_LABEL_KEY[toilet.type] ?? 'toilet.type.public')}
          </div>

          <h1 className="text-ink-primary text-3xl font-medium">{name}</h1>
          <p className="text-ink-secondary">{address}</p>
        </div>

        {toilet.photos && toilet.photos.length > 0 && <PhotoGallery photos={toilet.photos} />}

        <div className="border-border-soft mt-10 border-t pt-6">
          <p className="text-ink-secondary text-sm">{t('toilet.detail.comingSoon')}</p>
        </div>

        <div className="text-ink-tertiary mt-12 font-mono text-xs">
          {t('toilet.detail.coordinates', {
            lat: toilet.latitude.toFixed(5),
            lng: toilet.longitude.toFixed(5),
          })}
        </div>
      </div>
    </main>
  )
}
