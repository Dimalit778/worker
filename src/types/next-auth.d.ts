import type { DefaultSession } from 'next-auth'
import type { Role } from '@/generated/prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      primaryCourtId: string | null
    } & DefaultSession['user']
  }

  interface User {
    role: Role
    primaryCourtId: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role
    primaryCourtId: string | null
  }
}
