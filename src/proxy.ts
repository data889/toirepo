import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/server/auth'
import { routing } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

// Admin pages require role=ADMIN; /me/* requires any logged-in user.
// Fine-grained role checks still happen in tRPC procedures (T2.3).
const ADMIN_PATH_RE = /^\/(zh-CN|ja|en)\/admin(\/.*)?$/
const PROTECTED_PATH_RE = /^\/(zh-CN|ja|en)\/me(\/.*)?$/

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Auth.js API routes must be served at bare /api/auth/* so that OAuth
  // callback URLs are stable — do not apply i18n or auth guards here.
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const intlResponse = intlMiddleware(request)

  if (ADMIN_PATH_RE.test(pathname) || PROTECTED_PATH_RE.test(pathname)) {
    const session = await auth()
    if (!session) {
      const locale = pathname.split('/')[1]
      const signInUrl = new URL(`/${locale}/auth/signin`, request.url)
      signInUrl.searchParams.set('callbackUrl', request.url)
      return NextResponse.redirect(signInUrl)
    }
    if (ADMIN_PATH_RE.test(pathname) && session.user.role !== 'ADMIN') {
      const locale = pathname.split('/')[1]
      return NextResponse.redirect(new URL(`/${locale}`, request.url))
    }
  }

  return intlResponse
}

export const config = {
  matcher: ['/((?!api/auth|_next|_vercel|.*\\..*).*)'],
}

// No `export const runtime` needed — Next.js 16 Proxy convention ALWAYS runs
// on Node.js. (The earlier middleware.ts variant needed runtime='nodejs' to
// escape the edge sandbox; proxy.ts removed that knob entirely.)
