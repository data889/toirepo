// Generate the full PWA icon set from a single source file.
//
// Source precedence:
//   1. public/icons/toirepo-icon-1024.png  (if Ming drops in a designer PNG)
//   2. public/icons/toirepo-icon-source.svg (built-in fallback)
//
// Outputs (public/icons/):
//   icon-192.png, icon-256.png, icon-384.png, icon-512.png   (purpose: any)
//   icon-192-maskable.png, icon-512-maskable.png             (purpose: maskable)
//   apple-touch-icon.png (180×180)                            (iOS, no mask)
//
// Maskable flavour: content is rendered at 80% of the target size and
// composited onto a full-bleed teal background, giving Android's 40%
// safe-zone mask a clean margin on every side.
//
// Usage:
//   pnpm gen:icons

import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ICONS_DIR = path.join(process.cwd(), 'public/icons')
const PNG_SOURCE = path.join(ICONS_DIR, 'toirepo-icon-1024.png')
const SVG_SOURCE = path.join(ICONS_DIR, 'toirepo-icon-source.svg')

// Bg color for maskable padding — matches the darker end of the radial
// gradient so the masked outline stays cohesive.
const MASKABLE_BG = '#2C6B8F'

async function main() {
  const source = existsSync(PNG_SOURCE) ? PNG_SOURCE : SVG_SOURCE
  console.log(`🎨 Source: ${path.relative(process.cwd(), source)}`)
  if (!existsSync(source)) {
    throw new Error(`No source icon found. Expected ${PNG_SOURCE} or ${SVG_SOURCE}.`)
  }

  const anyPurposeSizes = [192, 256, 384, 512] as const
  const maskableSizes = [192, 512] as const

  for (const size of anyPurposeSizes) {
    const out = path.join(ICONS_DIR, `icon-${size}.png`)
    await sharp(source).resize(size, size).png({ compressionLevel: 9 }).toFile(out)
    console.log(`   → icon-${size}.png`)
  }

  for (const size of maskableSizes) {
    const out = path.join(ICONS_DIR, `icon-${size}-maskable.png`)
    const inner = Math.round(size * 0.8)
    const innerBuf = await sharp(source).resize(inner, inner).png().toBuffer()
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: MASKABLE_BG,
      },
    })
      .composite([{ input: innerBuf, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(out)
    console.log(`   → icon-${size}-maskable.png`)
  }

  // iOS Apple Touch Icon: 180×180, no mask, no transparent background
  // (iOS ignores alpha on home-screen icons). Flatten over teal so any
  // rounding iOS applies doesn't expose a dark edge.
  const appleOut = path.join(ICONS_DIR, 'apple-touch-icon.png')
  await sharp(source)
    .resize(180, 180)
    .flatten({ background: MASKABLE_BG })
    .png({ compressionLevel: 9 })
    .toFile(appleOut)
  console.log(`   → apple-touch-icon.png (180×180, flattened)`)

  console.log(`\n✅ Generated ${anyPurposeSizes.length + maskableSizes.length + 1} icons.`)
}

main().catch((e) => {
  console.error('❌ Icon generation failed:', e)
  process.exit(1)
})
