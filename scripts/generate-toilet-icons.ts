// Generate the four toilet-type marker SVGs per SPEC §4.2 + §4.4.
// One source of truth for shape, color, stroke, and letter rendering — manual
// per-file edits would diverge over time. Run via `pnpm icons:generate`;
// re-running overwrites all four files.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUTPUT_DIR = 'public/toilet-icons'

// SPEC §4.2 + §4.4
const ICON_SIZE = 32
const STROKE_WIDTH = 2.5
const STROKE_COLOR = '#FDFCF9' // paper color as outer border
const LETTER_COLOR = '#FDFCF9'
const LETTER_FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif'
const LETTER_SIZE = 14
const LETTER_WEIGHT = 500

type Shape = 'circle' | 'rounded-square' | 'triangle' | 'pentagon'

interface IconSpec {
  type: 'public' | 'mall' | 'konbini' | 'purchase'
  shape: Shape
  fill: string
  letter: string
  // Per-letter optical centering tweak. The triangle's center of mass sits
  // slightly above the geometric center, so its glyph reads better nudged
  // down a touch.
  letterYOffset?: number
}

const icons: IconSpec[] = [
  { type: 'public', shape: 'circle', fill: '#D4573A', letter: 'P' },
  { type: 'mall', shape: 'rounded-square', fill: '#2C6B8F', letter: 'M' },
  { type: 'konbini', shape: 'triangle', fill: '#5C8A3A', letter: 'C', letterYOffset: 3 },
  { type: 'purchase', shape: 'pentagon', fill: '#B8860B', letter: '¥' },
]

function shapePath(shape: Shape): string {
  const cx = ICON_SIZE / 2 // 16
  const cy = ICON_SIZE / 2 // 16
  const r = 13 // 3px margin from edge for stroke
  switch (shape) {
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" />`
    case 'rounded-square': {
      const size = r * 2
      const x = cx - r
      const y = cy - r
      return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="4" ry="4" />`
    }
    case 'triangle': {
      // Apex up; base horizontal. Apex (16, 3), base (3, 28) → (29, 28).
      return `<polygon points="${cx},3 ${cx - r},${cy + r} ${cx + r},${cy + r}" />`
    }
    case 'pentagon': {
      // Shield: flat top, pointed bottom. Top (5,6) (27,6),
      // mid-flanks (3,20) (29,20), bottom point (16,29).
      const top = 6
      const midY = 20
      const bottomY = 29
      const leftX = 5
      const rightX = 27
      const edgeX = 3
      const edgeRX = 29
      return `<polygon points="${leftX},${top} ${rightX},${top} ${edgeRX},${midY} ${cx},${bottomY} ${edgeX},${midY}" />`
    }
  }
}

function buildSvg(spec: IconSpec): string {
  const { shape, fill, letter, letterYOffset = 0 } = spec
  // SVG <text> y is the baseline; +5 from center vertically centers
  // single-line uppercase glyphs at our letter size. Per-shape nudge added.
  const textY = 16 + 5 + letterYOffset
  const shapeEl = shapePath(shape)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" width="${ICON_SIZE}" height="${ICON_SIZE}" role="img" aria-label="toilet marker (${spec.type})">
  <g fill="${fill}" stroke="${STROKE_COLOR}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round">
    ${shapeEl}
  </g>
  <text x="${ICON_SIZE / 2}" y="${textY}" text-anchor="middle"
        font-family='${LETTER_FONT}'
        font-size="${LETTER_SIZE}" font-weight="${LETTER_WEIGHT}"
        fill="${LETTER_COLOR}">${letter}</text>
</svg>
`
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })
  for (const spec of icons) {
    const svg = buildSvg(spec)
    const filepath = path.join(OUTPUT_DIR, `${spec.type}.svg`)
    await writeFile(filepath, svg)
    console.log(`✅ ${filepath}`)
  }
  console.log(`\nGenerated ${icons.length} icons → ${OUTPUT_DIR}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
