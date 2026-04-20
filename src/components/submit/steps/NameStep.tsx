'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { LocalizedTabs, type LocaleKey } from './LocalizedTabs'
import type { LocalizedString } from '../SubmitForm'

interface NameStepProps {
  value: LocalizedString
  onChange: (value: LocalizedString) => void
}

export function NameStep({ value, onChange }: NameStepProps) {
  const t = useTranslations('submit.name')

  function setFor(locale: LocaleKey, text: string) {
    onChange({ ...value, [locale]: text })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-ink-primary text-lg font-medium">{t('title')}</h2>
      <p className="text-ink-secondary text-sm">{t('hint')}</p>

      <LocalizedTabs>
        {(locale) => (
          <Input
            value={value[locale] ?? ''}
            onChange={(e) => setFor(locale, e.target.value)}
            placeholder={t(`placeholder.${locale}`)}
            maxLength={200}
          />
        )}
      </LocalizedTabs>
    </section>
  )
}
