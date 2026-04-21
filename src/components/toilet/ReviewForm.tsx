'use client'

import { useEffect, useRef, useState } from 'react'
// Effects below only handle teardown (URL.revokeObjectURL); state is
// initialized once from `existing` since the parent conditionally
// mounts this component on each open, giving us a fresh instance.
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Loader2, Upload, X } from 'lucide-react'
import { TRPCClientError } from '@trpc/client'
import { toast } from 'sonner'
import { useRouter, usePathname } from '@/i18n/navigation'
import { api } from '@/lib/trpc/client'
import { uploadPhotoToR2, type UploadedPhoto } from '@/lib/photo-upload'
import { useSession } from '@/hooks/useSession'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Maxima mirror server-side zod (2000-char body, 4 photoKeys).
const MAX_BODY = 2000
const MAX_PHOTOS = 4

export interface ReviewFormProps {
  toiletId: string
  open: boolean
  onClose: () => void
  /** Pre-fill star + body when caller already knows the user has a row. */
  existing?: { rating: number; body: string | null; photoKeys: string[] }
}

interface PhotoSlot {
  originalKey: string
  thumbnailKey: string
  previewUrl: string
}

export function ReviewForm({ toiletId, open, onClose, existing }: ReviewFormProps) {
  const t = useTranslations('toilet.review.form')
  const session = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const [rating, setRating] = useState<number>(existing?.rating ?? 0)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [body, setBody] = useState<string>(existing?.body ?? '')
  const [photos, setPhotos] = useState<PhotoSlot[]>(
    (existing?.photoKeys ?? []).map((key) => ({
      // Pre-existing review: keys exist server-side but no preview blob.
      // We don't render thumbnails for them in this MVP — the user can
      // re-upload to replace.
      originalKey: key,
      thumbnailKey: key,
      previewUrl: '',
    })),
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const utils = api.useUtils()
  const createReview = api.review.create.useMutation()
  const createUploadUrl = api.photo.createUploadUrl.useMutation()

  // Free Object URLs the form created on unmount. Parent unmounts the
  // form on Dialog close, so this fires every close cycle.
  useEffect(() => {
    return () => {
      photos.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isAuthenticated = session.status === 'authenticated'
  const trustLevel = session.user?.trustLevel ?? 0
  const meetsTrust = trustLevel >= 1

  async function handleFiles(files: FileList) {
    setUploadError(null)
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) return
    setUploading(true)
    const next: PhotoSlot[] = []
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const up: UploadedPhoto = await uploadPhotoToR2(
          file,
          (input) => createUploadUrl.mutateAsync(input),
          'reviews',
        )
        next.push({
          originalKey: up.originalKey,
          thumbnailKey: up.thumbnailKey,
          previewUrl: up.previewUrl,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed'
        setUploadError(`${file.name}: ${msg}`)
      }
    }
    setUploading(false)
    if (next.length > 0) setPhotos((p) => [...p, ...next])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removePhoto(idx: number) {
    const removed = photos[idx]
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
    setPhotos((p) => p.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (rating < 1 || createReview.isPending) return
    try {
      const result = await createReview.mutateAsync({
        toiletId,
        rating,
        body: body.trim() ? body.trim() : undefined,
        photoKeys: photos.map((p) => p.originalKey),
      })
      // Server returns 'PENDING' or 'REJECTED'. APPROVED is admin-only
      // today (canAutoPublish is hard-false in MVP — the L3-skip path
      // is reserved for V1.0). Toast wording reflects actual status.
      const successKey = result.status === 'PENDING' ? 'success' : 'successAutoPublished'
      toast.success(t(successKey))
      await utils.review.listByToilet.invalidate({ toiletId })
      onClose()
    } catch (e) {
      const code = e instanceof TRPCClientError ? (e.data?.code ?? 'UNKNOWN') : 'UNKNOWN'
      switch (code) {
        case 'UNAUTHORIZED':
          toast.error(t('errorUnauthorized'))
          redirectToSignin()
          break
        case 'FORBIDDEN':
          toast.error(t('errorForbidden'))
          break
        case 'TOO_MANY_REQUESTS':
          toast.error(t('errorTooFrequent'))
          break
        default:
          toast.error(t('errorGeneric'))
      }
    }
  }

  function redirectToSignin() {
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}` as never)
  }

  // Three-state UI inside the Dialog body. Order matters so we render
  // the most common gate first (logged out > L0 user > L1+ form).
  let body_node: React.ReactNode
  if (session.status === 'loading') {
    body_node = (
      <div className="text-ink-secondary py-8 text-center text-sm">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    )
  } else if (!isAuthenticated) {
    body_node = (
      <div className="space-y-3 py-4 text-center">
        <p className="text-ink-secondary text-sm">{t('requireLogin')}</p>
        <Button onClick={redirectToSignin} type="button">
          {t('signinCta')}
        </Button>
      </div>
    )
  } else if (!meetsTrust) {
    body_node = (
      <div className="space-y-3 py-4 text-center">
        <p className="text-ink-secondary text-sm">{t('requireTrust')}</p>
        <Button variant="outline" type="button" onClick={() => router.push('/submit' as never)}>
          {t('goSubmit')}
        </Button>
      </div>
    )
  } else {
    body_node = (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
        className="space-y-4"
      >
        <fieldset className="space-y-2">
          <legend className="text-ink-primary text-sm font-medium">{t('ratingLabel')}</legend>
          <StarPicker
            rating={rating}
            hoverRating={hoverRating}
            onHover={setHoverRating}
            onPick={setRating}
          />
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="review-body" className="text-ink-primary text-sm font-medium">
            {t('bodyLabel')}
          </Label>
          <Textarea
            id="review-body"
            placeholder={t('bodyPlaceholder')}
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
            rows={4}
          />
          <p className="text-ink-tertiary text-right text-xs">
            {t('charCount', { current: body.length, max: MAX_BODY })}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-ink-primary text-sm font-medium">
            {t('photosLabel')}{' '}
            <span className="text-ink-tertiary text-xs font-normal">
              ({photos.length}/{MAX_PHOTOS})
            </span>
          </Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p, i) => (
              <div
                key={`${p.originalKey}-${i}`}
                className="border-border-soft bg-paper-deep relative aspect-square overflow-hidden rounded border"
              >
                {p.previewUrl ? (
                  <Image
                    src={p.previewUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="bg-paper-deep h-full w-full" />
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label={t('removePhoto')}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="border-border-soft text-ink-secondary hover:bg-paper-deep flex aspect-square flex-col items-center justify-center gap-1 rounded border-2 border-dashed disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span className="text-xs">{t('addPhoto')}</span>
                  </>
                )}
              </button>
            )}
          </div>
          {uploadError && (
            <p className="text-xs" style={{ color: 'var(--color-accent-coral, #D4573A)' }}>
              {uploadError}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={rating < 1 || createReview.isPending || uploading}>
            {createReview.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('submitting')}
              </>
            ) : (
              t('submit')
            )}
          </Button>
        </DialogFooter>
      </form>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-paper sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? t('editTitle') : t('title')}</DialogTitle>
          <DialogDescription className="text-ink-tertiary text-xs">
            {t('moderationNote')}
          </DialogDescription>
        </DialogHeader>
        {body_node}
      </DialogContent>
    </Dialog>
  )
}

interface StarPickerProps {
  rating: number
  hoverRating: number
  onHover: (n: number) => void
  onPick: (n: number) => void
}

// Click + hover star input. Five buttons with discrete value semantics
// — fractional ratings are not part of the API (server zod constrains
// to integers 1..5).
function StarPicker({ rating, hoverRating, onHover, onPick }: StarPickerProps) {
  const display = hoverRating > 0 ? hoverRating : rating
  return (
    <div
      className="inline-flex items-center gap-1"
      onMouseLeave={() => onHover(0)}
      role="radiogroup"
      aria-label="rating"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            onMouseEnter={() => onHover(n)}
            onClick={() => onPick(n)}
            className="rounded p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2"
          >
            <svg
              viewBox="0 0 20 20"
              width="28"
              height="28"
              fill={filled ? 'rgb(236 182 106)' : 'none'}
              stroke="rgb(236 182 106)"
              strokeWidth="1.5"
            >
              <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L10 14.77 4.8 17.5l.99-5.78L1.58 7.62l5.82-.85L10 1.5z" />
            </svg>
            <span className="sr-only">{n}</span>
          </button>
        )
      })}
    </div>
  )
}
