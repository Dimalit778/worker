import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import type { Session } from 'next-auth'
import { Role } from '@prisma/client'

export function hasRole(session: Session | null, role: Role): boolean {
  return session?.user?.role === role
}

export function isGuard(session: Session | null): boolean {
  return hasRole(session, Role.GUARD)
}

export function isManager(session: Session | null): boolean {
  return hasRole(session, Role.MANAGER)
}

/**
 * Use in server components / route handlers.
 * Redirects to /login if unauthenticated.
 * Redirects to /login if authenticated but wrong role.
 */
export async function requireSession(requiredRole?: Role): Promise<Session> {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (requiredRole && session.user.role !== requiredRole) redirect('/login')

  return session
}
