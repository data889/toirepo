'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export type ToiletType = 'PUBLIC' | 'MALL' | 'KONBINI' | 'PURCHASE'

interface TypeStepProps {
  type: ToiletType | null
  onChange: (type: ToiletType) => void
}

// Colors pinned to SPEC §4.2 / COLORS.md. Do not re-harmonize by eye.
const TYPE_OPTIONS: ReadonlyArray<{ value: ToiletType; color: string; iconFile: string }> = [
  { value: 'PUBLIC', color: '#D4573A', iconFile: '/toilet-icons/public.svg' },
  { value: 'MALL', color: '#2C6B8F', iconFile: '/toilet-icons/mall.svg' },
  { value: 'KONBINI', color: '#5C8A3A', iconFile: '/toilet-icons/konbini.svg' },
  { value: 'PURCHASE', color: '#B8860B', iconFile: '/toilet-icons/purchase.svg' },
]

export function TypeStep({ type, onChange }: TypeStepProps) {
  const t = useTranslations('submit.type')

  return (
    <section className="space-y-3">
      <h2 className="text-ink-primary text-lg font-medium">{t('title')}</h2>
      <p className="text-ink-secondary text-sm">{t('hint')}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TYPE_OPTIONS.map((opt) => {
          const active = type === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition-all',
                active
                  ? 'bg-paper-deep shadow-sm'
                  : 'border-border-soft bg-paper hover:bg-paper-deep',
              )}
              style={active ? { borderColor: opt.color } : undefined}
              aria-pressed={active}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: active ? opt.color : 'transparent' }}
              >
                <Image
                  src={opt.iconFile}
                  alt=""
                  width={32}
                  height={32}
                  className={active ? 'brightness-0 invert' : ''}
                />
              </div>
              <div className="text-ink-primary text-sm font-medium">{t(`${opt.value}.label`)}</div>
              <div className="text-ink-tertiary text-xs leading-tight">
                {t(`${opt.value}.hint`)}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
