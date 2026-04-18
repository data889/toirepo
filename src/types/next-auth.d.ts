import type { UserRole } from '@/generated/prisma'
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: UserRole
      locale: string
    }
  }
  interface User {
    role: UserRole
    locale: string
  }
}
