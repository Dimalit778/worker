import { PortalRole, type PortalRole as PortalRoleValue } from '@/lib/auth/portal';

function homeFor(role: PortalRoleValue): string {
  switch (role) {
    case PortalRole.EMPLOYEE:
      return '/employee';
    case PortalRole.MANAGER:
      return '/manager';
    case PortalRole.ADMIN:
      return '/admin';
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled role: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Pure function — no Next.js dependency.
 * Returns the URL to redirect to, or null if the request should proceed.
 */
export function resolveRedirect(pathname: string, role: PortalRoleValue | null, mustChangePassword = false): string | null {
  if (
    role &&
    mustChangePassword &&
    !pathname.startsWith('/change-password') &&
    !pathname.startsWith('/api/auth')
  ) {
    return '/change-password';
  }

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return null;
  }

  if (pathname === '/') {
    if (!role) return '/login';
    return homeFor(role);
  }

  if (pathname.startsWith('/employee')) {
    if (!role) return '/login';
    if (role !== PortalRole.EMPLOYEE) return homeFor(role);
    return null;
  }

  if (pathname.startsWith('/manager')) {
    if (!role) return '/login';
    if (role !== PortalRole.MANAGER) return homeFor(role);
    return null;
  }

  if (pathname.startsWith('/admin')) {
    if (!role) return '/login';
    if (role !== PortalRole.ADMIN) return homeFor(role);
    return null;
  }

  return null;
}
