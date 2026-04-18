import type { UserRole } from '@/generated/prisma'
import 'next-auth'
import 'next-auth/adapters'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: UserRole
      locale: string
      bannedAt: Date | null
      emailVerified: Date | null
    }
  }
  interface User {
    role: UserRole
    locale: string
    bannedAt: Date | null
  }
}

// PrismaAdapter passes the full Prisma User row to the session callback as
// `AdapterUser`. Augment so custom fields (role, locale, bannedAt) are
// visible when the callback consumes them.
declare module 'next-auth/adapters' {
  interface AdapterUser {
    role: UserRole
    locale: string
    bannedAt: Date | null
  }
}
