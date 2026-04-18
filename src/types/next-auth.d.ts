import type { DefaultSession } from 'next-auth';
import type { SystemRole } from '@/generated/prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      systemRole: SystemRole;
      primaryCourtId: string | null;
      employeeNumber: string | null;
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    systemRole: SystemRole;
    primaryCourtId: string | null;
    employeeNumber: string | null;
    mustChangePassword: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    systemRole: SystemRole;
    primaryCourtId: string | null;
    employeeNumber: string | null;
    mustChangePassword: boolean;
  }
}
