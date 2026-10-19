import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';

import { authOptions } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/client';
import { SystemRole } from '@/generated/prisma/client';
import { PortalRole, type PortalRole as PortalRoleValue } from '@/lib/auth/portal';

export function hasRole(session: Session | null, role: PortalRoleValue): boolean {
  return session?.user?.portal === role;
}

export function isEmployee(session: Session | null): boolean {
  return hasRole(session, PortalRole.EMPLOYEE);
}

export function isManager(session: Session | null): boolean {
  return hasRole(session, PortalRole.MANAGER);
}

export function isAdmin(session: Session | null): boolean {
  return hasRole(session, PortalRole.ADMIN);
}

export function isManagerOrAdmin(session: Session | null): boolean {
  return isManager(session) || isAdmin(session);
}

function portalFor(user: {
  systemRole: SystemRole;
  canEditSchedule: boolean;
}): PortalRoleValue {
  if (user.systemRole === SystemRole.ADMIN) return PortalRole.ADMIN;
  if (user.canEditSchedule) return PortalRole.MANAGER;
  return PortalRole.EMPLOYEE;
}

// Deduplicated per request: layout, page and prefetch queries share one session + user lookup.
const loadSession = cache(async (): Promise<Session> => {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user || !user.isActive) redirect('/login');
  const portal = portalFor(user);
  if (portal === PortalRole.MANAGER && !user.facilityId) redirect('/login');
  session.user = {
    ...session.user,
    systemRole: user.systemRole,
    portal,
    facilityId: user.facilityId,
    employeeId: user.id,
    mustChangePassword: false,
  };

  return session;
});

export async function requireSession(requiredRole?: PortalRoleValue): Promise<Session> {
  const session = await loadSession();
  if (requiredRole && session.user.portal !== requiredRole) redirect('/login');

  return session;
}

export async function requireManager() {
  const session = await requireSession(PortalRole.MANAGER);

  if (!session.user.facilityId) {
    throw new Error('MANAGER_COURT_REQUIRED');
  }

  return {
    session,
    userId: session.user.id,
    facilityId: session.user.facilityId,
  };
}

export async function requireEmployee() {
  const session = await requireSession(PortalRole.EMPLOYEE);

  if (!session.user.facilityId || !session.user.employeeId) {
    throw new Error('EMPLOYEE_CONTEXT_REQUIRED');
  }

  return {
    session,
    userId: session.user.id,
    facilityId: session.user.facilityId,
    employeeId: session.user.employeeId,
  };
}
