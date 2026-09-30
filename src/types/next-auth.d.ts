import type { DefaultSession } from 'next-auth';
import type { SystemRole } from '@/generated/prisma/client';
import type { PortalRole } from '@/lib/auth/portal';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      systemRole: SystemRole;
      portal: PortalRole;
      facilityId: string | null;
      employeeId: string | null;
      mustChangePassword: boolean;
      fullName?: string;
    } & DefaultSession['user'];
  }

  interface User {
    systemRole: SystemRole;
    portal: PortalRole;
    facilityId: string | null;
    employeeId: string | null;
    mustChangePassword: boolean;
    fullName?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    systemRole: SystemRole;
    portal?: PortalRole;
    facilityId: string | null;
    employeeId: string | null;
    mustChangePassword: boolean;
    fullName?: string;
  }
}
