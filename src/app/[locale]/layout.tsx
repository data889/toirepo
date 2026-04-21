import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { routing } from '@/i18n/routing'
import { TRPCProvider } from '@/lib/trpc/client'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { AnalyticsProvider } from '@/components/providers/AnalyticsProvider'
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar'
import { Toaster } from '@/components/ui/sonner'
import { getSiteUrl } from '@/lib/site-url'
import '../globals.css'

// PWA wiring (M9 P1). The manifest lives at /manifest.webmanifest via
// src/app/manifest.ts. iOS uses applewebapp + apple-touch-icon rather
// than the manifest's maskable set; everything else comes through the
// manifest referenced below.

// Per-page metadata (e.g. /t/[slug] generateMetadata) builds on this
// template. metadataBase makes openGraph + twitter image / canonical
// URLs absolute even when individual pages set relative paths.
const SITE = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'toirepo',
    template: '%s · toirepo',
  },
  description: '商业建筑里的免费厕所 — 进入路径细节、实时有效性，填补 Google / Apple 地图的盲区。',
  applicationName: 'toirepo',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'toirepo',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'toirepo',
    title: 'toirepo',
    description: '商业建筑里的免费厕所，进入路径细节，实时有效性 — 填补 Google/Apple 地图的盲区。',
    url: SITE,
    locale: 'zh_CN',
    alternateLocale: ['ja_JP', 'en_US'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'toirepo',
    description: '商业建筑里的免费厕所，进入路径细节，实时有效性 — 填补 Google/Apple 地图的盲区。',
  },
  alternates: {
    canonical: SITE,
    languages: {
      'zh-CN': `${SITE}/zh-CN`,
      ja: `${SITE}/ja`,
      en: `${SITE}/en`,
      'x-default': `${SITE}/zh-CN`,
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
}

// Next 15+ moved themeColor and viewport width out of `metadata` into
// a dedicated `viewport` export. Same user-facing effect.
export const viewport: Viewport = {
  themeColor: '#51999F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // viewport-fit=cover tells iOS to extend the layout under the notch
  // / home indicator. Pages that need to avoid UI-safe areas pull
  // env(safe-area-inset-*) into padding (see [locale]/page.tsx top
  // padding for the map header).
  viewportFit: 'cover',
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        <NextIntlClientProvider>
          <SessionProvider>
            <AnalyticsProvider />
            <TRPCProvider>{children}</TRPCProvider>
          </SessionProvider>
        </NextIntlClientProvider>
        <Toaster position="top-center" />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
