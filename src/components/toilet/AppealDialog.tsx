'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Upload, X } from 'lucide-react'
import { TRPCClientError } from '@trpc/client'
import { toast } from 'sonner'
import { useRouter, usePathname } from '@/i18n/navigation'
import { api } from '@/lib/trpc/client'
import { uploadPhotoToR2, type UploadedPhoto } from '@/lib/photo-upload'
import { useSession } from '@/hooks/useSession'
import { track } from '@/lib/analytics/posthog'
import { resolveToiletName, resolveToiletAddress } from '@/lib/map/toilet-labels'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// 6 AppealType values mirror the discriminated union in
// src/server/api/routers/appeal/index.ts. Trust + ownership filtering
// happens client-side as a UX courtesy — the server enforces the same
// rules and returns FORBIDDEN if a request bypasses the UI.

const MAX_PHOTOS = 5
const MAX_REASON = 2000

type AppealType =
  | 'OWN_SUBMISSION_REJECT'
  | 'SELF_SOFT_DELETE'
  | 'REPORT_CLOSED'
  | 'REPORT_NO_TOILET'
  | 'REPORT_DATA_ERROR'
  | 'SUGGEST_EDIT'

interface AppealOption {
  type: AppealType
  minTrust: number
  /** When true, hide unless the toilet is the caller's own submission. */
  ownershipRequired: boolean
  /** Required toilet status; null = any non-hidden. */
  requiredStatus: 'APPROVED' | 'REJECTED' | null
  /** Server-side reason min — display in helper text. */
  minReason: number
}

const OPTIONS: AppealOption[] = [
  {
    type: 'REPORT_NO_TOILET',
    minTrust: 1,
    ownershipRequired: false,
    requiredStatus: 'APPROVED',
    minReason: 10,
  },
  {
    type: 'REPORT_CLOSED',
    minTrust: 1,
    ownershipRequired: false,
    requiredStatus: 'APPROVED',
    minReason: 10,
  },
  {
    type: 'SUGGEST_EDIT',
    minTrust: 2,
    ownershipRequired: false,
    requiredStatus: 'APPROVED',
    minReason: 10,
  },
  {
    type: 'REPORT_DATA_ERROR',
    minTrust: 2,
    ownershipRequired: false,
    requiredStatus: 'APPROVED',
    minReason: 20,
  },
  {
    type: 'OWN_SUBMISSION_REJECT',
    minTrust: 1,
    ownershipRequired: true,
    requiredStatus: 'REJECTED',
    minReason: 20,
  },
  {
    type: 'SELF_SOFT_DELETE',
    minTrust: 1,
    ownershipRequired: true,
    requiredStatus: 'APPROVED',
    minReason: 10,
  },
]

export interface AppealDialogProps {
  open: boolean
  onClose: () => void
  toilet: {
    id: string
    status: string
    submittedById: string | null
    name: unknown
    address: unknown
    type: 'PUBLIC' | 'MALL' | 'KONBINI' | 'PURCHASE'
    floor: string | null
  }
  /**
   * When set, skip Step 1's type picker and jump straight into Step 2
   * with this AppealType pre-selected. Used by /me/submissions to file
   * an OWN_SUBMISSION_REJECT against a REJECTED row that the toilet
   * drawer can't otherwise reach (toilet.getBySlug filters out REJECTED).
   * Caller MUST pass a toilet whose status / ownership satisfies the
   * type's gate, or the server will return BAD_REQUEST / FORBIDDEN.
   */
  initialType?: AppealType
}

interface PhotoSlot {
  originalKey: string
  thumbnailKey: string
  previewUrl: string
}

export function AppealDialog({ open, onClose, toilet, initialType }: AppealDialogProps) {
  const t = useTranslations('toilet.appeal')
  const locale = useLocale()
  const session = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const [step, setStep] = useState<1 | 2>(initialType ? 2 : 1)
  const [chosen, setChosen] = useState<AppealType | null>(initialType ?? null)
  const [reason, setReason] = useState('')
  const [photos, setPhotos] = useState<PhotoSlot[]>([])
  // SUGGEST_EDIT pre-fill on mount when initialType skipped Step 1.
  // The advanceToStep2() helper does the same thing for the normal
  // path; conditional initial state mirrors it on the preset path.
  const [editName, setEditName] = useState(() =>
    initialType === 'SUGGEST_EDIT' ? resolveToiletName(toilet, locale) : '',
  )
  const [editAddress, setEditAddress] = useState(() =>
    initialType === 'SUGGEST_EDIT' ? resolveToiletAddress(toilet, locale) : '',
  )
  const [editType, setEditType] = useState<'PUBLIC' | 'MALL' | 'KONBINI' | 'PURCHASE' | ''>(
    initialType === 'SUGGEST_EDIT' ? toilet.type : '',
  )
  const [editFloor, setEditFloor] = useState(() =>
    initialType === 'SUGGEST_EDIT' ? (toilet.floor ?? '') : '',
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const createAppeal = api.appeal.create.useMutation()
  const createUploadUrl = api.photo.createUploadUrl.useMutation()

  const isAuthenticated = session.status === 'authenticated'
  const userId = session.user?.id ?? null
  const trustLevel = session.user?.trustLevel ?? 0

  const visibleOptions = OPTIONS.filter((o) => {
    if (trustLevel < o.minTrust) return false
    if (o.ownershipRequired && toilet.submittedById !== userId) return false
    if (o.requiredStatus && toilet.status !== o.requiredStatus) return false
    return true
  })

  // Free Object URLs on unmount.
  useEffect(() => {
    return () => {
      photos.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function advanceToStep2() {
    if (!chosen) return
    if (chosen === 'SUGGEST_EDIT') {
      // Pre-fill from current values so the user only needs to change
      // what's actually different. Empty values stay out of the diff.
      setEditName(resolveToiletName(toilet, locale))
      setEditAddress(resolveToiletAddress(toilet, locale))
      setEditType(toilet.type)
      setEditFloor(toilet.floor ?? '')
    }
    setStep(2)
  }

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
          'appeals',
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

  // SUGGEST_EDIT diff — only fields that actually changed enter the
  // proposedChanges payload. Empty string === "leave unset", not
  // "clear field" (the API has no explicit clear semantics today).
  function buildProposedChanges() {
    const currentName = resolveToiletName(toilet, locale)
    const currentAddress = resolveToiletAddress(toilet, locale)
    const pc: Record<string, unknown> = {}
    if (editName.trim() && editName.trim() !== currentName) pc.name = editName.trim()
    if (editAddress.trim() && editAddress.trim() !== currentAddress) {
      pc.address = editAddress.trim()
    }
    if (editType && editType !== toilet.type) pc.type = editType
    if (editFloor.trim() !== (toilet.floor ?? '')) pc.floor = editFloor.trim()
    return pc
  }

  async function handleSubmit() {
    if (!chosen || createAppeal.isPending) return
    const opt = OPTIONS.find((o) => o.type === chosen)!
    if (reason.trim().length < opt.minReason) {
      toast.error(t('errorReasonTooShort', { min: opt.minReason }))
      return
    }

    try {
      const evidence = photos.map((p) => p.originalKey)
      let payload: Parameters<typeof createAppeal.mutateAsync>[0]
      switch (chosen) {
        case 'SUGGEST_EDIT': {
          const proposedChanges = buildProposedChanges()
          if (Object.keys(proposedChanges).length === 0) {
            toast.error(t('errorNoChange'))
            return
          }
          payload = {
            type: 'SUGGEST_EDIT',
            targetToiletId: toilet.id,
            reason: reason.trim(),
            proposedChanges,
            evidence,
          }
          break
        }
        case 'SELF_SOFT_DELETE':
          payload = {
            type: 'SELF_SOFT_DELETE',
            targetToiletId: toilet.id,
            reason: reason.trim(),
          }
          break
        default:
          payload = {
            type: chosen,
            targetToiletId: toilet.id,
            reason: reason.trim(),
            evidence,
          }
      }
      await createAppeal.mutateAsync(payload)
      toast.success(t('toastSuccess'))
      track('appeal_created', { toiletId: toilet.id, type: chosen })
      onClose()
    } catch (e) {
      const code = e instanceof TRPCClientError ? (e.data?.code ?? 'UNKNOWN') : 'UNKNOWN'
      switch (code) {
        case 'UNAUTHORIZED':
          toast.error(t('errorUnauthorized'))
          router.push(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}` as never)
          break
        case 'FORBIDDEN':
          toast.error(t('errorForbidden'))
          break
        case 'CONFLICT':
          toast.error(t('errorDuplicate'))
          break
        case 'TOO_MANY_REQUESTS':
          toast.error(t('errorTooFrequent'))
          break
        default:
          toast.error(t('errorGeneric'))
      }
    }
  }

  // Body branches mirror ReviewForm's pattern: loading > unauth > L0
  // (no visible options) > step 1 (pick type) > step 2 (fill form).
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
        <Button
          type="button"
          onClick={() =>
            router.push(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}` as never)
          }
        >
          {t('signinCta')}
        </Button>
      </div>
    )
  } else if (visibleOptions.length === 0) {
    body_node = (
      <div className="space-y-3 py-4 text-center">
        <p className="text-ink-secondary text-sm">{t('emptyL0')}</p>
        <Button variant="outline" type="button" onClick={() => router.push('/submit' as never)}>
          {t('goSubmit')}
        </Button>
      </div>
    )
  } else if (step === 1) {
    body_node = (
      <div className="space-y-4 py-2">
        <RadioGroup
          value={chosen ?? ''}
          onValueChange={(v: string) => setChosen(v as AppealType)}
          className="space-y-2"
        >
          {visibleOptions.map((opt) => (
            <Label
              key={opt.type}
              htmlFor={`appeal-${opt.type}`}
              className="border-border-soft hover:bg-paper-deep flex cursor-pointer items-start gap-3 rounded border p-3"
            >
              <RadioGroupItem id={`appeal-${opt.type}`} value={opt.type} className="mt-1" />
              <div className="flex-1">
                <div className="text-ink-primary text-sm font-medium">
                  {t(`type.${opt.type}.label`)}
                </div>
                <div className="text-ink-tertiary text-xs">{t(`type.${opt.type}.description`)}</div>
              </div>
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={advanceToStep2} disabled={!chosen}>
            {t('next')}
          </Button>
        </DialogFooter>
      </div>
    )
  } else {
    const opt = OPTIONS.find((o) => o.type === chosen)!
    body_node = (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
        className="space-y-4"
      >
        <p className="text-ink-secondary text-xs">
          <span className="text-ink-primary font-medium">{t(`type.${opt.type}.label`)}</span>
          {' — '}
          {t(`type.${opt.type}.description`)}
        </p>

        {chosen === 'SUGGEST_EDIT' && (
          <div className="bg-paper-deep space-y-2 rounded p-3">
            <p className="text-ink-tertiary text-xs">{t('editHint')}</p>
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-ink-secondary text-xs">
                {t('editNameLabel')}
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address" className="text-ink-secondary text-xs">
                {t('editAddressLabel')}
              </Label>
              <Input
                id="edit-address"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="edit-type" className="text-ink-secondary text-xs">
                  {t('editTypeLabel')}
                </Label>
                <select
                  id="edit-type"
                  value={editType}
                  onChange={(e) =>
                    setEditType(e.target.value as 'PUBLIC' | 'MALL' | 'KONBINI' | 'PURCHASE' | '')
                  }
                  className="border-input bg-background h-9 w-full rounded border px-2 text-sm"
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="MALL">MALL</option>
                  <option value="KONBINI">KONBINI</option>
                  <option value="PURCHASE">PURCHASE</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-floor" className="text-ink-secondary text-xs">
                  {t('editFloorLabel')}
                </Label>
                <Input
                  id="edit-floor"
                  value={editFloor}
                  onChange={(e) => setEditFloor(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="appeal-reason" className="text-ink-primary text-sm font-medium">
            {t('reasonLabel')}
          </Label>
          <Textarea
            id="appeal-reason"
            placeholder={t(`type.${opt.type}.reasonPlaceholder`)}
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
            rows={4}
          />
          <p className="text-ink-tertiary text-right text-xs">
            {t('reasonCharCount', { current: reason.length, min: opt.minReason, max: MAX_REASON })}
          </p>
        </div>

        {chosen !== 'SELF_SOFT_DELETE' && (
          <div className="space-y-2">
            <Label className="text-ink-primary text-sm font-medium">
              {t('evidenceLabel')}{' '}
              <span className="text-ink-tertiary text-xs font-normal">
                ({photos.length}/{MAX_PHOTOS})
              </span>
            </Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.map((p, i) => (
                <div
                  key={`${p.originalKey}-${i}`}
                  className="border-border-soft bg-paper-deep relative aspect-square overflow-hidden rounded border"
                >
                  <Image
                    src={p.previewUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="80px"
                    className="object-cover"
                  />
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
                  className="border-border-soft text-ink-secondary flex aspect-square flex-col items-center justify-center gap-1 rounded border-2 border-dashed disabled:opacity-50"
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
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStep(1)
              setReason('')
            }}
          >
            {t('back')}
          </Button>
          <Button type="submit" disabled={createAppeal.isPending || uploading}>
            {createAppeal.isPending ? (
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
      <DialogContent className="bg-paper sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === 1 ? t('step1Title') : t('step2Title')}</DialogTitle>
          <DialogDescription className="text-ink-tertiary text-xs">
            {t('moderationNote')}
          </DialogDescription>
        </DialogHeader>
        {body_node}
      </DialogContent>
    </Dialog>
  )
}
