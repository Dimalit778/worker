import { PortalRole } from '@/lib/auth/portal';
import { describe, it, expect } from 'vitest';
import { resolveRedirect } from '@/lib/middleware';

describe('resolveRedirect', () => {
  // Public routes
  it('returns null for /login (public route)', () => {
    expect(resolveRedirect('/login', null)).toBeNull();
  });

  it('returns null for /api/auth routes', () => {
    expect(resolveRedirect('/api/auth/session', null)).toBeNull();
    expect(resolveRedirect('/api/auth/callback/credentials', null)).toBeNull();
  });

  // Root redirect
  it('redirects unauthenticated user from / to /login', () => {
    expect(resolveRedirect('/', null)).toBe('/login');
  });

  it('redirects EMPLOYEE from / to /employee', () => {
    expect(resolveRedirect('/', PortalRole.EMPLOYEE)).toBe('/employee');
  });

  it('redirects MANAGER from / to /manager', () => {
    expect(resolveRedirect('/', PortalRole.MANAGER)).toBe('/manager');
  });

  it('redirects ADMIN from / to /admin', () => {
    expect(resolveRedirect('/', PortalRole.ADMIN)).toBe('/admin');
  });

  // /employee routes
  it('returns null (no redirect) when EMPLOYEE accesses /employee routes', () => {
    expect(resolveRedirect('/employee', PortalRole.EMPLOYEE)).toBeNull();
    expect(resolveRedirect('/employee/availability/abc', PortalRole.EMPLOYEE)).toBeNull();
    expect(resolveRedirect('/employee/submissions/xyz', PortalRole.EMPLOYEE)).toBeNull();
  });

  it('redirects unauthenticated user from /employee to /login', () => {
    expect(resolveRedirect('/employee', null)).toBe('/login');
    expect(resolveRedirect('/employee/availability/abc', null)).toBe('/login');
  });

  it('redirects MANAGER away from /employee to /manager', () => {
    expect(resolveRedirect('/employee', PortalRole.MANAGER)).toBe('/manager');
    expect(resolveRedirect('/employee/availability/abc', PortalRole.MANAGER)).toBe('/manager');
  });

  it('redirects ADMIN away from /employee to /admin', () => {
    expect(resolveRedirect('/employee', PortalRole.ADMIN)).toBe('/admin');
  });

  // /manager routes
  it('returns null (no redirect) when MANAGER accesses /manager routes', () => {
    expect(resolveRedirect('/manager', PortalRole.MANAGER)).toBeNull();
    expect(resolveRedirect('/manager/periods/new', PortalRole.MANAGER)).toBeNull();
    expect(resolveRedirect('/manager/guards', PortalRole.MANAGER)).toBeNull();
    expect(resolveRedirect('/manager/shibutz', PortalRole.MANAGER)).toBeNull();
  });

  it('redirects unauthenticated user from /manager to /login', () => {
    expect(resolveRedirect('/manager', null)).toBe('/login');
    expect(resolveRedirect('/manager/periods/new', null)).toBe('/login');
  });

  it('redirects EMPLOYEE away from /manager to /employee', () => {
    expect(resolveRedirect('/manager', PortalRole.EMPLOYEE)).toBe('/employee');
    expect(resolveRedirect('/manager/periods/new', PortalRole.EMPLOYEE)).toBe('/employee');
  });

  it('redirects ADMIN away from /manager to /admin', () => {
    expect(resolveRedirect('/manager', PortalRole.ADMIN)).toBe('/admin');
  });

  // /admin routes
  it('returns null (no redirect) when ADMIN accesses /admin routes', () => {
    expect(resolveRedirect('/admin', PortalRole.ADMIN)).toBeNull();
    expect(resolveRedirect('/admin/courts', PortalRole.ADMIN)).toBeNull();
    expect(resolveRedirect('/admin/managers', PortalRole.ADMIN)).toBeNull();
    expect(resolveRedirect('/admin/guards', PortalRole.ADMIN)).toBeNull();
    expect(resolveRedirect('/admin/config', PortalRole.ADMIN)).toBeNull();
  });

  it('redirects unauthenticated user from /admin to /login', () => {
    expect(resolveRedirect('/admin', null)).toBe('/login');
    expect(resolveRedirect('/admin/config', null)).toBe('/login');
  });

  it('redirects EMPLOYEE away from /admin to /employee', () => {
    expect(resolveRedirect('/admin', PortalRole.EMPLOYEE)).toBe('/employee');
  });

  it('redirects MANAGER away from /admin to /manager', () => {
    expect(resolveRedirect('/admin', PortalRole.MANAGER)).toBe('/manager');
  });

  // Unrecognised paths pass through
  it('returns null for unrecognised paths (no redirect)', () => {
    expect(resolveRedirect('/some/unknown/path', PortalRole.MANAGER)).toBeNull();
    expect(resolveRedirect('/favicon.ico', null)).toBeNull();
  });

  describe('mustChangePassword', () => {
    it('redirects authenticated EMPLOYEE with mustChangePassword to /change-password', () => {
      expect(resolveRedirect('/employee', PortalRole.EMPLOYEE, true)).toBe('/change-password');
    });

    it('redirects authenticated MANAGER with mustChangePassword to /change-password', () => {
      expect(resolveRedirect('/manager', PortalRole.MANAGER, true)).toBe('/change-password');
    });

    it('does not redirect if already on /change-password', () => {
      expect(resolveRedirect('/change-password', PortalRole.EMPLOYEE, true)).toBeNull();
    });

    it('does not redirect api/auth routes even with mustChangePassword', () => {
      expect(resolveRedirect('/api/auth/session', PortalRole.EMPLOYEE, true)).toBeNull();
    });

    it('does not redirect unauthenticated user even when mustChangePassword is true', () => {
      expect(resolveRedirect('/employee', null, true)).toBe('/login');
    });

    it('returns null for authenticated user with mustChangePassword false', () => {
      expect(resolveRedirect('/employee', PortalRole.EMPLOYEE, false)).toBeNull();
    });

    it('returns null when mustChangePassword omitted (defaults false)', () => {
      expect(resolveRedirect('/employee', PortalRole.EMPLOYEE)).toBeNull();
    });
  });
});
