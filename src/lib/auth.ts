import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';

/** Legacy JWT used `role` (GUARD | MANAGER | ADMIN); middleware only reads `systemRole`. */
function systemRoleFromLegacyJwt(token: { systemRole?: SystemRole; role?: unknown }): SystemRole | undefined {
  if (token.systemRole) return token.systemRole;
  const r = typeof token.role === 'string' ? token.role : null;
  if (r === 'GUARD' || r === 'EMPLOYEE') return SystemRole.EMPLOYEE;
  if (r === 'MANAGER') return SystemRole.MANAGER;
  if (r === 'ADMIN') return SystemRole.ADMIN;
  return undefined;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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
          where: {
            OR: [
              { employeeNumber: credentials.identifier },
              { email: credentials.identifier },
            ],
          },
          include: { employee: true },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        const primaryCourtId = user.employee?.primaryCourtId ?? null;
        const name = user.employee?.name ?? user.email ?? user.employeeNumber ?? '';

        return {
          id: user.id,
          email: user.email,
          name,
          systemRole: user.systemRole,
          primaryCourtId,
          employeeNumber: user.employeeNumber ?? null,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.systemRole = user.systemRole;
        token.primaryCourtId = user.primaryCourtId;
        token.employeeNumber = user.employeeNumber;
        token.mustChangePassword = user.mustChangePassword;
      } else {
        const migrated = systemRoleFromLegacyJwt(token as { systemRole?: SystemRole; role?: unknown });
        if (migrated && !token.systemRole) {
          token.systemRole = migrated;
        }
        if (token.mustChangePassword === undefined) token.mustChangePassword = false;
        if (token.employeeNumber === undefined) token.employeeNumber = null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.systemRole = token.systemRole;
        session.user.primaryCourtId = token.primaryCourtId;
        session.user.employeeNumber = token.employeeNumber ?? null;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
      }
      return session;
    },
  },
};
