import { Role } from '@/generated/prisma/client'

/** Returns the home path for a given role. */
function homeFor(role: Role): string {
  if (role === Role.GUARD) return '/user'
  if (role === Role.MANAGER) return '/manager'
  return '/admin'
}

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
    return homeFor(role)
  }

  // User (guard) routes
  if (pathname.startsWith('/user')) {
    if (!role) return '/login'
    if (role !== Role.GUARD) return homeFor(role)
    return null
  }

  // Manager routes
  if (pathname.startsWith('/manager')) {
    if (!role) return '/login'
    if (role !== Role.MANAGER) return homeFor(role)
    return null
  }

  // Admin routes
  if (pathname.startsWith('/admin')) {
    if (!role) return '/login'
    if (role !== Role.ADMIN) return homeFor(role)
    return null
  }

  // All other paths: no redirect
  return null
}
