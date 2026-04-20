'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { PhotoStep } from './steps/PhotoStep'
import { LocationStep } from './steps/LocationStep'
import { TypeStep, type ToiletType } from './steps/TypeStep'
import { NameStep } from './steps/NameStep'
import { AccessNoteStep } from './steps/AccessNoteStep'

export interface PhotoData {
  originalKey: string
  thumbnailKey: string
  width: number
  height: number
  sizeBytes: number
  category: 'ENTRANCE' | 'SIGNAGE' | 'EXTERIOR' | 'BUILDING'
  previewUrl: string
}

export interface LocalizedString {
  'zh-CN'?: string
  ja?: string
  en?: string
}

interface SubmitFormState {
  photos: PhotoData[]
  latitude: number | null
  longitude: number | null
  type: ToiletType | null
  name: LocalizedString
  accessNote: LocalizedString
}

function hasAnyLocaleValue(s: LocalizedString): boolean {
  return Object.values(s).some((v) => typeof v === 'string' && v.length > 0)
}

export function SubmitForm() {
  const t = useTranslations('submit')
  const router = useRouter()

  const [state, setState] = useState<SubmitFormState>({
    photos: [],
    latitude: null,
    longitude: null,
    type: null,
    name: {},
    accessNote: {},
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSubmission = api.submission.create.useMutation()

  const canSubmit =
    state.photos.length >= 1 &&
    state.latitude !== null &&
    state.longitude !== null &&
    state.type !== null &&
    hasAnyLocaleValue(state.name)

  async function handleSubmit() {
    if (!canSubmit || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const photos = state.photos.map((p) => ({
        url: p.originalKey,
        thumbnailUrl: p.thumbnailKey,
        width: p.width,
        height: p.height,
        sizeBytes: p.sizeBytes,
        category: p.category,
      }))

      // Server-side LocalizedStringSchema.refine requires every used field
      // to have at least one non-empty locale. Name is the source of truth;
      // when the user skipped a locale, mirror the best available value so
      // address has the same three-locale coverage. Later passes (M5 P3 or
      // M6) can swap this for reverse geocoding.
      const fallbackName = state.name['zh-CN'] || state.name.ja || state.name.en || ''
      const address: LocalizedString = {
        'zh-CN': state.name['zh-CN'] || fallbackName,
        ja: state.name.ja || fallbackName,
        en: state.name.en || fallbackName,
      }

      const result = await createSubmission.mutateAsync({
        name: state.name,
        address,
        type: state.type!,
        latitude: state.latitude!,
        longitude: state.longitude!,
        accessNote: hasAnyLocaleValue(state.accessNote) ? state.accessNote : undefined,
        photos,
      })

      state.photos.forEach((p) => URL.revokeObjectURL(p.previewUrl))

      router.push(`/me/submissions?just_submitted=${result.slug}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-ink-primary text-2xl font-medium sm:text-3xl">{t('title')}</h1>

      <PhotoStep photos={state.photos} onChange={(photos) => setState((s) => ({ ...s, photos }))} />

      <LocationStep
        latitude={state.latitude}
        longitude={state.longitude}
        onChange={(lat, lng) => setState((s) => ({ ...s, latitude: lat, longitude: lng }))}
      />

      <TypeStep type={state.type} onChange={(type) => setState((s) => ({ ...s, type }))} />

      <NameStep value={state.name} onChange={(name) => setState((s) => ({ ...s, name }))} />

      <AccessNoteStep
        value={state.accessNote}
        onChange={(accessNote) => setState((s) => ({ ...s, accessNote }))}
      />

      {error && (
        <div className="rounded border border-[var(--color-accent-coral,#D4573A)] bg-[var(--color-accent-coral,#D4573A)]/10 p-3 text-sm text-[var(--color-accent-coral,#D4573A)]">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2 pb-12">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          size="lg"
          className="flex-1"
        >
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </div>
  )
}
