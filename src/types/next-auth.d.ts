import type { DefaultSession } from 'next-auth';
import type { SystemRole } from '@/generated/prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      systemRole: SystemRole;
      courtId: string;
      employeeId: string;
      mustChangePassword: boolean;
      fullName: string;
    } & DefaultSession['user'];
  }

  interface User {
    systemRole: SystemRole;
    courtId: string;
    employeeId: string;
    mustChangePassword: boolean;
    fullName: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    systemRole: SystemRole;
    courtId: string;
    employeeId: string;
    mustChangePassword: boolean;
    fullName: string;
  }
}
