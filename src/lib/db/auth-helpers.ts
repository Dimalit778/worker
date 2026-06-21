import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';

import { authOptions } from '@/lib/auth/auth';
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

export async function requireSession(requiredRole?: SystemRole): Promise<Session> {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  if (requiredRole && session.user.systemRole !== requiredRole) redirect('/login');

  return session;
}

export async function requireManager() {
  const session = await requireSession(SystemRole.MANAGER);

  if (!session.user.courtId) {
    throw new Error('MANAGER_COURT_REQUIRED');
  }

  return {
    session,
    userId: session.user.id,
    courtId: session.user.courtId,
  };
}

export async function requireEmployee() {
  const session = await requireSession(SystemRole.EMPLOYEE);

  if (!session.user.courtId || !session.user.employeeId) {
    throw new Error('EMPLOYEE_CONTEXT_REQUIRED');
  }

  return {
    session,
    userId: session.user.id,
    courtId: session.user.courtId,
    employeeId: session.user.employeeId,
  };
}
