import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { PortalRole, type PortalRole as PortalRoleValue } from '@/lib/auth/portal';
import { resolveRedirect } from '@/lib/middleware';

function portalFromToken(token: { portal?: unknown; systemRole?: unknown; role?: unknown } | null): PortalRoleValue | null {
  const portal = token?.portal;
  if (portal === PortalRole.EMPLOYEE || portal === PortalRole.MANAGER || portal === PortalRole.ADMIN) return portal;
  const role = token?.systemRole ?? token?.role;
  if (role === 'ADMIN') return PortalRole.ADMIN;
  if (role === 'MANAGER') return PortalRole.MANAGER;
  if (role === 'EMPLOYEE' || role === 'GUARD' || role === 'USER') return PortalRole.EMPLOYEE;
  return null;
}

export default withAuth(
  function middleware(req) {
    const role = portalFromToken(req.nextauth.token);
    const mustChangePassword = (req.nextauth.token?.mustChangePassword ?? false) as boolean;
    const redirect = resolveRedirect(req.nextUrl.pathname, role, mustChangePassword);

    if (redirect) {
      return NextResponse.redirect(new URL(redirect, req.url));
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: '/login' },
    callbacks: {
      authorized: () => true,
    },
  },
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
