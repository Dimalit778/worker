import { Role } from '@prisma/client'

/**
 * Pure function — no Next.js dependency.
 * Returns the URL to redirect to, or null if the request should proceed.
 */
export function resolveRedirect(pathname: string, role: Role | null): string | null {
  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return null
  }

  // Root redirect
  if (pathname === '/') {
    if (!role) return '/login'
    return role === Role.GUARD ? '/guard' : '/manager'
  }

  // Guard routes
  if (pathname.startsWith('/guard')) {
    if (!role) return '/login'
    if (role !== Role.GUARD) return '/manager'
    return null
  }

  // Manager routes
  if (pathname.startsWith('/manager')) {
    if (!role) return '/login'
    if (role !== Role.MANAGER) return '/guard'
    return null
  }

  // All other paths: no redirect
  return null
}
