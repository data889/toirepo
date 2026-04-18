import { getTranslations } from 'next-intl/server'

export default async function VerifyRequestPage() {
  const t = await getTranslations('auth.verifyRequest')
  return (
    <main className="bg-paper flex min-h-screen items-center justify-center px-6">
      <section className="max-w-sm text-center">
        <h1 className="text-ink-primary text-xl font-medium">{t('title')}</h1>
        <p className="text-ink-secondary mt-3 text-sm">{t('body')}</p>
      </section>
    </main>
  )
}
