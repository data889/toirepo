import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Resend from 'next-auth/providers/resend'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './db'

// Session is obtained via auth() in Server Components / Route Handlers.
// No client-side SessionProvider is wired up yet — add it in M3+ if a
// client component ever needs to read session without a prop drill.

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: { strategy: 'database' },
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
  },
  callbacks: {
    // Google verifies email ownership before issuing an OAuth consent, so
    // any account arriving via the Google provider is implicitly
    // email-verified. PrismaAdapter leaves User.emailVerified = null on
    // create because the Google provider doesn't forward `email_verified`
    // into the adapter.createUser payload — we patch it here. Cheap guard
    // skips the UPDATE on returning logins where it's already set.
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        const existing = await db.user.findUnique({
          where: { email: user.email },
          select: { id: true, emailVerified: true },
        })
        if (existing && !existing.emailVerified) {
          await db.user.update({
            where: { id: existing.id },
            data: { emailVerified: new Date() },
          })
        }
      }
      return true
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        session.user.role = user.role
        session.user.locale = user.locale
        session.user.bannedAt = user.bannedAt
        session.user.emailVerified = user.emailVerified
        // M7 P1: trustLevel is read on every protected procedure
        // (canReviewToilet / canAppeal), session carries it to avoid
        // per-request DB round-trip in the auth middleware.
        session.user.trustLevel = user.trustLevel
      }
      return session
    },
  },
})
