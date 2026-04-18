import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { SystemRole } from '@/generated/prisma/client';
import { resolveRedirect } from '@/lib/middleware';

export default withAuth(
  function middleware(req) {
    const role = (req.nextauth.token?.systemRole ?? null) as SystemRole | null;
    const redirect = resolveRedirect(req.nextUrl.pathname, role);

    if (redirect) {
      return NextResponse.redirect(new URL(redirect, req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Let the middleware function handle all authorization decisions.
      // Return true here so withAuth always calls our middleware function.
      authorized: () => true,
    },
  },
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
