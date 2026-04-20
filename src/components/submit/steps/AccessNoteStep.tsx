'use client'

import { useTranslations } from 'next-intl'
import { Textarea } from '@/components/ui/textarea'
import { LocalizedTabs, type LocaleKey } from './LocalizedTabs'
import type { LocalizedString } from '../SubmitForm'

interface AccessNoteStepProps {
  value: LocalizedString
  onChange: (value: LocalizedString) => void
}

export function AccessNoteStep({ value, onChange }: AccessNoteStepProps) {
  const t = useTranslations('submit.accessNote')

  function setFor(locale: LocaleKey, text: string) {
    onChange({ ...value, [locale]: text })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-ink-primary text-lg font-medium">{t('title')}</h2>
      <p className="text-ink-secondary text-sm">{t('hint')}</p>

      <LocalizedTabs>
        {(locale) => (
          <Textarea
            value={value[locale] ?? ''}
            onChange={(e) => setFor(locale, e.target.value)}
            placeholder={t(`placeholder.${locale}`)}
            maxLength={200}
            rows={4}
          />
        )}
      </LocalizedTabs>
    </section>
  )
}
