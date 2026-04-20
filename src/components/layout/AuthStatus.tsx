import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { auth, signOut } from '@/server/auth'

// Server Component — reads the session directly via auth(). Avoids the
// SessionProvider dependency (see src/server/auth.ts note) and lets the
// sign-out control be a <form> with a server action, so no client-side
// hydration is required.

export async function AuthStatus() {
  const session = await auth()
  const t = await getTranslations('auth')

  if (!session?.user) {
    return (
      <Link href="/auth/signin" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
        {t('signIn')}
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-ink-secondary hidden text-xs sm:inline">{session.user.email}</span>
      <Link href="/me/submissions" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
        {t('mySubmissions')}
      </Link>
      <form
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/' })
        }}
      >
        <button type="submit" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          {t('signOut')}
        </button>
      </form>
    </div>
  )
}
