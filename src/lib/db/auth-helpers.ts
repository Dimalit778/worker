import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';

import { authOptions } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/client';
import { FacilityRole, SystemRole } from '@/generated/prisma/client';
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
  facilityRoles: { role: FacilityRole }[];
  employee: { isActive: boolean } | null;
}): PortalRoleValue | null {
  if (user.systemRole === SystemRole.ADMIN) return PortalRole.ADMIN;
  if (user.facilityRoles.some((membership) => membership.role === FacilityRole.MANAGER)) return PortalRole.MANAGER;
  if (user.employee) return PortalRole.EMPLOYEE;
  return null;
}

export async function requireSession(requiredRole?: PortalRoleValue): Promise<Session> {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      employee: true,
      facilityRoles: { where: { role: FacilityRole.MANAGER }, orderBy: { facilityId: 'asc' } },
    },
  });
  if (!user) redirect('/login');
  const portal = portalFor(user);
  if (!portal) redirect('/login');
  const facilityId = user.facilityRoles[0]?.facilityId ?? user.employee?.facilityId ?? null;
  if (portal === PortalRole.MANAGER && !facilityId) redirect('/login');
  if (portal === PortalRole.EMPLOYEE && !user.employee?.isActive) redirect('/login');
  session.user = {
    ...session.user,
    systemRole: user.systemRole,
    portal,
    facilityId,
    employeeId: user.employee?.id ?? null,
    mustChangePassword: user.mustChangePassword,
  };
  if (requiredRole && portal !== requiredRole) redirect('/login');

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
