'use client'

import Image from 'next/image'
import { useBatchPhotoUrls } from '@/hooks/useBatchPhotoUrls'
import { track } from '@/lib/analytics/posthog'

export interface GalleryPhoto {
  id: string
  url: string
  thumbnailUrl: string
  width: number
  height: number
}

export interface PhotoGalleryProps {
  photos: GalleryPhoto[]
  /** Where this gallery is rendered — drives the photo_viewed analytics event. */
  source?: 'drawer' | 'detail' | 'gallery'
}

// Simple grid gallery. Full-size URL opens in a new tab — no lightbox
// until M7+ (per scope note in M5 Prompt 3).
export function PhotoGallery({ photos, source = 'gallery' }: PhotoGalleryProps) {
  const keys = photos.flatMap((p) => [p.url, p.thumbnailUrl])
  const { urls } = useBatchPhotoUrls(keys)

  if (photos.length === 0) return null

  return (
    <div className="mt-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo) => {
          const thumbUrl = urls[photo.thumbnailUrl]
          const fullUrl = urls[photo.url]
          return (
            <a
              key={photo.id}
              href={fullUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border-soft bg-paper-deep relative block aspect-square overflow-hidden rounded border"
              aria-disabled={!fullUrl}
              onClick={() => track('photo_viewed', { source })}
            >
              {thumbUrl ? (
                <Image
                  src={thumbUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover transition-transform hover:scale-105"
                  unoptimized
                />
              ) : (
                <div className="bg-paper-deep h-full w-full animate-pulse" />
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}
