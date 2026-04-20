'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export type LocaleKey = 'zh-CN' | 'ja' | 'en'

// Hand-rolled 3-button locale tabs (deliberately skipping base-ui Tabs —
// simpler and avoids coupling to a primitive API we'd have to relearn if
// it changes). Shared by NameStep and AccessNoteStep.

interface LocalizedTabsProps {
  children: (locale: LocaleKey) => ReactNode
}

const LOCALES: ReadonlyArray<LocaleKey> = ['zh-CN', 'ja', 'en']

export function LocalizedTabs({ children }: LocalizedTabsProps) {
  const [active, setActive] = useState<LocaleKey>('zh-CN')
  const t = useTranslations('locale')

  return (
    <div>
      <div role="tablist" className="border-border-soft mb-2 flex gap-0 border-b">
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            role="tab"
            aria-selected={active === locale}
            onClick={() => setActive(locale)}
            className={cn(
              'relative -mb-px px-4 py-2 text-sm font-medium transition-colors',
              active === locale
                ? 'text-ink-primary border-b-2 border-[var(--color-accent-coral,#D4573A)]'
                : 'text-ink-tertiary hover:text-ink-secondary border-b-2 border-transparent',
            )}
          >
            {t(locale)}
          </button>
        ))}
      </div>
      <div>{children(active)}</div>
    </div>
  )
}
