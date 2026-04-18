import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { SystemRole } from '@/generated/prisma/client';

export function hasRole(session: Session | null, role: SystemRole): boolean {
  return session?.user?.systemRole === role;
}

export function isEmployee(session: Session | null): boolean {
  return hasRole(session, SystemRole.EMPLOYEE);
}

export function isManager(session: Session | null): boolean {
  return hasRole(session, SystemRole.MANAGER);
}

export function isAdmin(session: Session | null): boolean {
  return hasRole(session, SystemRole.ADMIN);
}

export function isManagerOrAdmin(session: Session | null): boolean {
  return isManager(session) || isAdmin(session);
}

/**
 * Use in server components / route handlers.
 * Redirects to /login if unauthenticated.
 * Redirects to /login if authenticated but wrong role.
 */
export async function requireSession(requiredRole?: SystemRole): Promise<Session> {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  if (requiredRole && session.user.systemRole !== requiredRole) redirect('/login');

  return session;
}
