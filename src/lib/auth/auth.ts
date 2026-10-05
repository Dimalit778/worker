import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { PortalRole, type PortalRole as PortalRoleValue } from '@/lib/auth/portal';

function portalFromLegacy(role: unknown): PortalRoleValue | undefined {
  if (role === 'ADMIN') return PortalRole.ADMIN;
  if (role === 'MANAGER') return PortalRole.MANAGER;
  if (role === 'GUARD' || role === 'EMPLOYEE' || role === 'USER') return PortalRole.EMPLOYEE;
  return undefined;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Employee Number / Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: { email: credentials.identifier },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        const portal =
          user.systemRole === SystemRole.ADMIN
            ? PortalRole.ADMIN
            : user.canEditSchedule
              ? PortalRole.MANAGER
              : PortalRole.EMPLOYEE;

        return {
          id: user.id,
          email: user.email,
          fullName: user.displayName,
          systemRole: user.systemRole,
          portal,
          facilityId: user.facilityId,
          employeeId: user.id,
          mustChangePassword: false,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.systemRole = user.systemRole;
        token.portal = user.portal;
        token.facilityId = user.facilityId;
        token.employeeId = user.employeeId;
        token.mustChangePassword = user.mustChangePassword;
        token.fullName = user.fullName;
      } else if (!token.portal) {
        const legacy = portalFromLegacy(token.systemRole) ?? portalFromLegacy((token as { role?: unknown }).role);
        if (legacy) {
          token.portal = legacy;
          if (legacy !== PortalRole.ADMIN) token.systemRole = SystemRole.USER;
        }
        if (token.mustChangePassword === undefined) token.mustChangePassword = false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.systemRole = token.systemRole;
        session.user.portal = token.portal ?? PortalRole.EMPLOYEE;
        session.user.facilityId = token.facilityId;
        session.user.employeeId = token.employeeId;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
        session.user.fullName = token.fullName || session.user.name || session.user.email || '';
      }
      return session;
    },
  },
};
