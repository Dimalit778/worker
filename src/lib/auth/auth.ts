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
          include: { employee: true },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        const courtId = user.employee?.courtId;
        const employeeId = user.employee?.id;
        if (!courtId || !employeeId) return null;
        return {
          id: user.id,
          email: user.email,
          fullName: user.employee?.firstName + ' ' + user.employee?.lastName,
          phone: user.employee?.phone,
          systemRole: user.systemRole,
          courtId,
          employeeId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.systemRole = user.systemRole;
        token.courtId = user.courtId;
        token.employeeId = user.employeeId;
        token.mustChangePassword = user.mustChangePassword;
        token.fullName = user.fullName;
      } else {
        const migrated = systemRoleFromLegacyJwt(token as { systemRole?: SystemRole; role?: unknown });
        if (migrated && !token.systemRole) {
          token.systemRole = migrated;
        }
        if (token.mustChangePassword === undefined) token.mustChangePassword = false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.systemRole = token.systemRole;
        session.user.courtId = token.courtId;
        session.user.employeeId = token.employeeId;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
        session.user.fullName = token.fullName;
      }
      return session;
    },
  },
};
