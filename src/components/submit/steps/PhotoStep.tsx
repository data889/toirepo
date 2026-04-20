'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Upload, X, Loader2 } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { processImageForUpload, uploadViaPresignedUrl } from '@/lib/upload/image-processing'
import type { PhotoData } from '../SubmitForm'

const MAX_PHOTOS = 4

interface PhotoStepProps {
  photos: PhotoData[]
  onChange: (photos: PhotoData[]) => void
}

export function PhotoStep({ photos, onChange }: PhotoStepProps) {
  const t = useTranslations('submit.photo')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const createUploadUrl = api.photo.createUploadUrl.useMutation()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function processAndUpload(file: File): Promise<PhotoData> {
    const { original, thumbnail } = await processImageForUpload(file)

    // Two parallel presigned-URL requests — server enforces per-user rate
    // limit, so in practice these burn 2 tokens per photo.
    const [origTicket, thumbTicket] = await Promise.all([
      createUploadUrl.mutateAsync({
        contentType: 'image/webp',
        contentLength: original.sizeBytes,
        kind: 'original',
      }),
      createUploadUrl.mutateAsync({
        contentType: 'image/webp',
        contentLength: thumbnail.sizeBytes,
        kind: 'thumbnail',
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
      category: 'ENTRANCE',
      previewUrl,
    }
  }

  async function handleFiles(files: FileList) {
    setUploadError(null)
    const remainingSlots = MAX_PHOTOS - photos.length
    if (remainingSlots <= 0) return

    const selected = Array.from(files).slice(0, remainingSlots)
    setUploading(true)

    const newPhotos: PhotoData[] = []
    for (const file of selected) {
      try {
        const photo = await processAndUpload(file)
        newPhotos.push(photo)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed'
        console.error('Photo upload failed:', e)
        setUploadError(`${file.name}: ${msg}`)
      }
    }

    setUploading(false)

    if (newPhotos.length > 0) {
      onChange([...photos, ...newPhotos])
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].previewUrl)
    onChange(photos.filter((_, i) => i !== index))
  }

  const canAddMore = photos.length < MAX_PHOTOS

  return (
    <section className="space-y-3">
      <h2 className="text-ink-primary text-lg font-medium">
        {t('title')}{' '}
        <span className="text-ink-tertiary text-sm font-normal">
          {t('count', { current: photos.length, max: MAX_PHOTOS })}
        </span>
      </h2>
      <p className="text-ink-secondary text-sm">{t('hint')}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <div
            key={`${photo.originalKey}-${index}`}
            className="border-border-soft bg-paper-deep relative aspect-square overflow-hidden rounded border"
          >
            <Image
              src={photo.previewUrl}
              alt=""
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 640px) 50vw, 25vw"
            />
            <button
              type="button"
              onClick={() => removePhoto(index)}
              className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label={t('remove')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        {canAddMore && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="border-border-soft text-ink-secondary hover:bg-paper-deep flex aspect-square flex-col items-center justify-center gap-2 rounded border-2 border-dashed transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs">{t('uploading')}</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6" />
                <span className="text-xs">{t('add')}</span>
              </>
            )}
          </button>
        )}
      </div>

      {uploadError && (
        <div className="rounded border border-[var(--color-accent-coral,#D4573A)] bg-[var(--color-accent-coral,#D4573A)]/10 p-2 text-sm text-[var(--color-accent-coral,#D4573A)]">
          {uploadError}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </section>
  )
}
