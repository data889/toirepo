/**
 * URL-safe slug from arbitrary input. Lowercases, normalizes, strips
 * combining marks, replaces non-ASCII alphanumerics with hyphens, trims
 * leading/trailing hyphens, caps at 80 chars (DB column is unbounded but
 * URLs / readability degrade past that).
 *
 * Returns '' if input has no usable characters; callers should fall back
 * to a stable id-based slug in that case.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
