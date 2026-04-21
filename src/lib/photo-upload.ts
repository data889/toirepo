'use client'

import { processImageForUpload, uploadViaPresignedUrl } from '@/lib/upload/image-processing'

// Shared client-side photo upload orchestrator. Three call sites:
//   - M5 SubmitForm PhotoStep      (usage: 'submissions')
//   - M7 P2.2 ReviewForm           (usage: 'reviews')
//   - M7 P2.2 AppealDialog         (usage: 'appeals')
//
// Pulling this out of PhotoStep keeps three duplicate copies from
// drifting (especially around EXIF strip + thumbnail generation).
//
// The function takes `createTicket` as a callable so callers can plug
// in `api.photo.createUploadUrl.mutateAsync` without forcing this
// module to depend on the tRPC client (would prevent server-side
// import via tree-shake guarantees).

export type PhotoUsage = 'submissions' | 'reviews' | 'appeals'

export interface UploadedPhoto {
  originalKey: string
  thumbnailKey: string
  width: number
  height: number
  sizeBytes: number
  /** Object URL of the in-memory thumbnail blob — release with revokeObjectURL on unmount. */
  previewUrl: string
}

export type PhotoTicketCreator = (input: {
  contentType: 'image/webp' | 'image/jpeg'
  contentLength: number
  kind: 'original' | 'thumbnail'
  usage: PhotoUsage
}) => Promise<{ photoId: string; key: string; uploadUrl: string; expiresIn: number }>

export async function uploadPhotoToR2(
  file: File,
  createTicket: PhotoTicketCreator,
  usage: PhotoUsage,
): Promise<UploadedPhoto> {
  const { original, thumbnail } = await processImageForUpload(file)

  // Two parallel presigned-URL requests — server enforces per-user
  // photo:upload rate limit, so each photo burns 2 tokens.
  const [origTicket, thumbTicket] = await Promise.all([
    createTicket({
      contentType: 'image/webp',
      contentLength: original.sizeBytes,
      kind: 'original',
      usage,
    }),
    createTicket({
      contentType: 'image/webp',
      contentLength: thumbnail.sizeBytes,
      kind: 'thumbnail',
      usage,
    }),
  ])

  await Promise.all([
    uploadViaPresignedUrl(origTicket.uploadUrl, original.blob),
    uploadViaPresignedUrl(thumbTicket.uploadUrl, thumbnail.blob),
  ])

  // Preview uses the in-memory thumbnail blob to avoid a second
  // round-trip to R2 just to show what the user already selected.
  const previewUrl = URL.createObjectURL(thumbnail.blob)

  return {
    originalKey: origTicket.key,
    thumbnailKey: thumbTicket.key,
    width: original.width,
    height: original.height,
    sizeBytes: original.sizeBytes,
    previewUrl,
  }
}
