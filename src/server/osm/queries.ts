import { TOKYO_23_WARDS_BBOX, formatBbox } from './client'

// OQL for Tokyo 23 wards:
// - All public toilets (amenity=toilets) — PUBLIC
// - Convenience stores (shop=convenience) — KONBINI; most chains provide toilets
// - Malls + department stores (shop=mall / department_store) — MALL
//
// Deliberately excludes cafés/restaurants (PURCHASE type) for this first
// pass — they're noisy (most don't have toilets, or have customer-only
// access that varies by shop). A separate targeted pass can add them
// later with stricter filtering (e.g. only chains like Starbucks, Doutor).
//
// `out center;` asks Overpass to include a representative centroid for
// ways and relations, so non-node elements can still be geocoded.

export const TOKYO_TOILETS_OQL = `
[out:json][timeout:120];
(
  node["amenity"="toilets"](${formatBbox(TOKYO_23_WARDS_BBOX)});
  way["amenity"="toilets"](${formatBbox(TOKYO_23_WARDS_BBOX)});
  node["shop"="convenience"](${formatBbox(TOKYO_23_WARDS_BBOX)});
  node["shop"="mall"](${formatBbox(TOKYO_23_WARDS_BBOX)});
  node["shop"="department_store"](${formatBbox(TOKYO_23_WARDS_BBOX)});
  way["shop"="mall"](${formatBbox(TOKYO_23_WARDS_BBOX)});
  way["shop"="department_store"](${formatBbox(TOKYO_23_WARDS_BBOX)});
);
out center;
`.trim()
