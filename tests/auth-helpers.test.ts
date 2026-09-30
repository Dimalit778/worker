import { PortalRole } from '@/lib/auth/portal';
import { describe, it, expect } from 'vitest';
import { hasRole, isEmployee, isManager, isAdmin, isManagerOrAdmin } from '@/lib/db/auth-helpers';
import type { Session } from 'next-auth';

const makeSession = (portal: PortalRole): Session => ({
  user: {
    id: 'user-1',
    name: 'Test',
    email: 'test@test.com',
    systemRole: portal === PortalRole.ADMIN ? 'ADMIN' : 'USER',
    portal,
    facilityId: 'court-1',
    employeeId: 'employee-1',
    mustChangePassword: false,
  },
  expires: new Date(Date.now() + 86400_000).toISOString(),
});

describe('hasRole', () => {
  it('returns true when session role matches', () => {
    expect(hasRole(makeSession(PortalRole.EMPLOYEE), PortalRole.EMPLOYEE)).toBe(true);
    expect(hasRole(makeSession(PortalRole.MANAGER), PortalRole.MANAGER)).toBe(true);
    expect(hasRole(makeSession(PortalRole.ADMIN), PortalRole.ADMIN)).toBe(true);
  });

  it('returns false when roles do not match', () => {
    expect(hasRole(makeSession(PortalRole.EMPLOYEE), PortalRole.MANAGER)).toBe(false);
    expect(hasRole(makeSession(PortalRole.ADMIN), PortalRole.EMPLOYEE)).toBe(false);
  });

  it('returns false for null session', () => {
    expect(hasRole(null, PortalRole.EMPLOYEE)).toBe(false);
  });
});

describe('isEmployee', () => {
  it('returns true for EMPLOYEE session', () => {
    expect(isEmployee(makeSession(PortalRole.EMPLOYEE))).toBe(true);
  });

  it('returns false for MANAGER session', () => {
    expect(isEmployee(makeSession(PortalRole.MANAGER))).toBe(false);
  });

  it('returns false for ADMIN session', () => {
    expect(isEmployee(makeSession(PortalRole.ADMIN))).toBe(false);
  });
});

describe('isManager', () => {
  it('returns true for MANAGER session', () => {
    expect(isManager(makeSession(PortalRole.MANAGER))).toBe(true);
  });

  it('returns false for EMPLOYEE session', () => {
    expect(isManager(makeSession(PortalRole.EMPLOYEE))).toBe(false);
  });

  it('returns false for ADMIN session', () => {
    expect(isManager(makeSession(PortalRole.ADMIN))).toBe(false);
  });
});

describe('isAdmin', () => {
  it('returns true for ADMIN session', () => {
    expect(isAdmin(makeSession(PortalRole.ADMIN))).toBe(true);
  });

  it('returns false for MANAGER session', () => {
    expect(isAdmin(makeSession(PortalRole.MANAGER))).toBe(false);
  });

  it('returns false for EMPLOYEE session', () => {
    expect(isAdmin(makeSession(PortalRole.EMPLOYEE))).toBe(false);
  });

  it('returns false for null session', () => {
    expect(isAdmin(null)).toBe(false);
  });
});

describe('isManagerOrAdmin', () => {
  it('returns true for MANAGER session', () => {
    expect(isManagerOrAdmin(makeSession(PortalRole.MANAGER))).toBe(true);
  });

  it('returns true for ADMIN session', () => {
    expect(isManagerOrAdmin(makeSession(PortalRole.ADMIN))).toBe(true);
  });

  it('returns false for EMPLOYEE session', () => {
    expect(isManagerOrAdmin(makeSession(PortalRole.EMPLOYEE))).toBe(false);
  });

  it('returns false for null session', () => {
    expect(isManagerOrAdmin(null)).toBe(false);
  });
});
