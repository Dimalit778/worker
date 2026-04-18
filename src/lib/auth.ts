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
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { employee: true },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        const primaryCourtId = user.employee?.primaryCourtId ?? null;
        const name = user.employee?.name ?? user.email;

        return {
          id: user.id,
          email: user.email,
          name,
          systemRole: user.systemRole,
          primaryCourtId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.systemRole = user.systemRole;
        token.primaryCourtId = user.primaryCourtId;
      } else {
        const migrated = systemRoleFromLegacyJwt(token as { systemRole?: SystemRole; role?: unknown });
        if (migrated && !token.systemRole) {
          token.systemRole = migrated;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.systemRole = token.systemRole;
        session.user.primaryCourtId = token.primaryCourtId;
      }
      return session;
    },
  },
};
