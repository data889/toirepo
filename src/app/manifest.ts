import type { MetadataRoute } from 'next'

// PWA manifest served at /manifest.webmanifest (Next.js App Router convention).
// Referenced by app/[locale]/layout.tsx metadata.
//
// Decisions:
// - start_url points at /zh-CN (current default locale per i18n/routing.ts).
//   If Ming changes default locale later, update this.
// - scope stays at / so the PWA captures every locale redirect.
// - display=standalone hides Safari chrome once installed.
// - orientation=portrait matches the natural phone usage; landscape still
//   works, just isn't default-forced.
// - Maskable icons sized per Android / Chrome expectations (192 + 512).
//   iOS ignores maskable and uses apple-touch-icon — wired via metadata,
//   not manifest.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'toirepo · 东京厕所地图',
    short_name: 'toirepo',
    description:
      '东京 23 区真实厕所地图。10,000+ 条公厕 / 便利店 / 商场数据，来自 OpenStreetMap + 用户提交。',
    lang: 'zh-CN',
    dir: 'ltr',
    start_url: '/zh-CN',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FDFCF9',
    theme_color: '#51999F',
    categories: ['travel', 'utilities', 'maps'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
