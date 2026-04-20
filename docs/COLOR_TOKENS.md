# Color Tokens · Social Layer (M7 P1)

Eight-color palette registered as CSS custom properties in
`src/app/globals.css` under the `@theme { }` block. P2 UI code consumes
these via Tailwind 4's `bg-<name>` / `text-<name>` / `border-<name>`
utility classes — the `--color-` prefix makes them first-class Tailwind
colors.

SPEC §4.2 palette (original map + icon colors) stays untouched; these
are additive, for social-layer surfaces only.

## Palette

| Token                   | RGB                 | Tailwind class root |
| ----------------------- | ------------------- | ------------------- |
| `--color-mint-light`    | rgb(191 223 210)    | `mint-light`        |
| `--color-teal-deep`     | rgb(81 153 159)     | `teal-deep`         |
| `--color-teal-blue`     | rgb(65 152 172)     | `teal-blue`         |
| `--color-sky-soft`      | rgb(123 192 205)    | `sky-soft`          |
| `--color-sand`          | rgb(219 203 146)    | `sand`              |
| `--color-amber`         | rgb(236 182 106)    | `amber`             |
| `--color-coral-soft`    | rgb(234 158 86)     | `coral-soft`        |
| `--color-coral-deep`    | rgb(237 141 90)     | `coral-deep`        |

## Semantic mapping (binding contract for P2)

| Use case                        | Token             | Notes                                                 |
| ------------------------------- | ----------------- | ----------------------------------------------------- |
| Star rating fill                | `amber`           | Matches the brand icon's "T" letterform color         |
| Confirmation button (hover)     | `teal-blue`       | Thumbs-up "还能用" still-exists control                |
| Confirmation button (active)    | `teal-deep`       | Already-confirmed-by-me state                          |
| Review card background (10%)    | `mint-light/10`   | Subtle separation inside drawer list                   |
| Review body text                | `ink-primary`     | Existing §4.2 token (no change)                       |
| Appeal warning banner           | `coral-deep`      | Destructive action surface                             |
| Appeal secondary text           | `coral-soft`      | Softer coral for timestamp / meta info                |
| Success toast / AI approved     | `teal-deep`       | Brand-aligned positive signal                          |
| Error toast / AI rejected       | `coral-deep`      | Matches existing `--color-error` tonality              |
| Info badge background           | `sky-soft/20`     | Light accent for neutral tags                         |
| Secondary surface               | `sand/30`         | Alt-row stripe / grouping panels                      |

## Naming conventions

- `mint-light`, `sky-soft`, `coral-soft` = softer variants; commonly used
  at 10–30% opacity for backgrounds.
- `teal-deep`, `coral-deep` = full strength; use as foreground / border.
- `teal-blue` sits between `teal-deep` and `sky-soft`; used for hover
  affordances where an "energized but not loud" signal is wanted.
- `amber` is tied to the brand mark (icon letterform). Reserve for
  rating affordances so the visual shorthand "amber = evaluation" stays
  consistent across the app.

## Opacity convention

Tailwind 4 supports `bg-mint-light/10` (10% opacity), `text-coral-deep/80`
(80%), etc. Use these for backgrounds / overlays so you don't need to
define `*-rgba` variants in the `@theme` block.

## Why RGB (not HEX) in `@theme`

RGB triplets separated by spaces (not commas) let Tailwind 4 parse the
value for its `color / opacity` shortcut. `#hex` works too but is less
flexible for the opacity path.

## Relation to SPEC §4.2

SPEC §4.2 defined:

- Toilet icon colors (`--color-toilet-public` etc.) — untouched.
- Paper + ink + semantic (`--color-paper`, `--color-ink-*`, etc.) —
  untouched.
- `--color-error` (#c5432a) and `--color-success` (#4a7a2c) — for
  compatibility with pre-M7 code.

The M7 palette uses RGB + lighter tones because the social-layer UI
needs finer opacity control than the map surface did. Both sets coexist;
new UI prefers the M7 tokens, existing map/icon UI sticks with §4.2.

## Future deprecation path

If the SPEC §4.2 ink tokens get extended to cover review bodies and we
standardize on one palette, remove this file and consolidate into
`docs/COLORS.md`. Not planned for M7 P1.
