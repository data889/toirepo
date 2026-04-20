import { getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { auth, signIn } from '@/server/auth'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Locale } from '@/i18n/routing'

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('auth.signin')

  const session = await auth()
  if (session) redirect({ href: '/', locale: locale as Locale })

  return (
    <>
      <AppHeader />
      <main className="bg-paper min-h-screen px-6 py-16">
        <section className="mx-auto max-w-sm space-y-8">
          <header className="text-center">
            <h1 className="text-ink-primary text-2xl font-medium">{t('title')}</h1>
            <p className="text-ink-secondary mt-2 text-sm">{t('subtitle')}</p>
          </header>

          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: `/${locale}` })
            }}
          >
            <Button type="submit" className="w-full" variant="outline">
              {t('google')}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <div className="border-border-soft h-px flex-1 border-t" />
            <span className="text-ink-tertiary text-xs">{t('or')}</span>
            <div className="border-border-soft h-px flex-1 border-t" />
          </div>

          <form
            action={async (formData: FormData) => {
              'use server'
              const email = formData.get('email') as string
              await signIn('resend', { email, redirectTo: `/${locale}` })
            }}
            className="space-y-3"
          >
            <div className="space-y-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" />
            </div>
            <Button type="submit" className="w-full">
              {t('emailSubmit')}
            </Button>
          </form>
        </section>
      </main>
    </>
  )
}
