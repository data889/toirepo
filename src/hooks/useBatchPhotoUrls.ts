'use client'

import { useMemo } from 'react'
import { api } from '@/lib/trpc/client'

// R2 photo keys are private; HTTP access requires a presigned URL obtained
// via photo.getViewUrls (1h TTL). Batching avoids N network round-trips
// when a page shows several thumbnails.
//
// Stale time deliberately sits under the URL TTL so the cache expires
// before the URLs do — using an expired URL returns a 403 from R2.
const TTL_FUDGE_MS = 50 * 60 * 1000

export function useBatchPhotoUrls(keys: string[]): {
  urls: Record<string, string>
  isLoading: boolean
} {
  const uniqueKeys = useMemo(
    () => Array.from(new Set(keys.filter((k): k is string => !!k && k.length > 0))).sort(),
    [keys],
  )

  const query = api.photo.getViewUrls.useQuery(
    { keys: uniqueKeys },
    {
      enabled: uniqueKeys.length > 0,
      staleTime: TTL_FUDGE_MS,
    },
  )

  return {
    urls: query.data ?? {},
    isLoading: query.isLoading,
  }
}
