import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { routing } from '@/i18n/routing'
import { TRPCProvider } from '@/lib/trpc/client'
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar'
import '../globals.css'

// PWA wiring (M9 P1). The manifest lives at /manifest.webmanifest via
// src/app/manifest.ts. iOS uses applewebapp + apple-touch-icon rather
// than the manifest's maskable set; everything else comes through the
// manifest referenced below.

export const metadata: Metadata = {
  title: 'toirepo',
  description: '东京公共厕所地图 · Tokyo public toilet map',
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
}

// Next 15+ moved themeColor and viewport width out of `metadata` into
// a dedicated `viewport` export. Same user-facing effect.
export const viewport: Viewport = {
  themeColor: '#51999F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
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
          <TRPCProvider>{children}</TRPCProvider>
        </NextIntlClientProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
