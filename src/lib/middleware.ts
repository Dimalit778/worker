import { SystemRole } from '@/generated/prisma/client';

/** Returns the home path for a given role. */
function homeFor(role: SystemRole): string {
  switch (role) {
    case SystemRole.EMPLOYEE:
      return '/employee';
    case SystemRole.MANAGER:
      return '/manager';
    case SystemRole.ADMIN:
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
export function resolveRedirect(pathname: string, role: SystemRole | null, mustChangePassword = false): string | null {
  if (
    role &&
    mustChangePassword &&
    !pathname.startsWith('/change-password') &&
    !pathname.startsWith('/api/auth')
  ) {
    return '/change-password';
  }

  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return null;
  }

  // Root redirect
  if (pathname === '/') {
    if (!role) return '/login';
    return homeFor(role);
  }

  // Employee routes
  if (pathname.startsWith('/employee')) {
    if (!role) return '/login';
    if (role !== SystemRole.EMPLOYEE) return homeFor(role);
    return null;
  }

  // Manager routes
  if (pathname.startsWith('/manager')) {
    if (!role) return '/login';
    if (role !== SystemRole.MANAGER) return homeFor(role);
    return null;
  }

  // Admin routes
  if (pathname.startsWith('/admin')) {
    if (!role) return '/login';
    if (role !== SystemRole.ADMIN) return homeFor(role);
    return null;
  }

  // All other paths: no redirect
  return null;
}
