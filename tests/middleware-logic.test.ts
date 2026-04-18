import { describe, it, expect } from 'vitest';
import { resolveRedirect } from '@/lib/middleware';
import { SystemRole } from '@/generated/prisma/client';

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

  it('redirects EMPLOYEE from / to /user', () => {
    expect(resolveRedirect('/', SystemRole.EMPLOYEE)).toBe('/user');
  });

  it('redirects MANAGER from / to /manager', () => {
    expect(resolveRedirect('/', SystemRole.MANAGER)).toBe('/manager');
  });

  it('redirects ADMIN from / to /admin', () => {
    expect(resolveRedirect('/', SystemRole.ADMIN)).toBe('/admin');
  });

  // /user routes
  it('returns null (no redirect) when EMPLOYEE accesses /user routes', () => {
    expect(resolveRedirect('/user', SystemRole.EMPLOYEE)).toBeNull();
    expect(resolveRedirect('/user/availability/abc', SystemRole.EMPLOYEE)).toBeNull();
    expect(resolveRedirect('/user/schedule/xyz', SystemRole.EMPLOYEE)).toBeNull();
    expect(resolveRedirect('/user/shibutz', SystemRole.EMPLOYEE)).toBeNull();
  });

  it('redirects unauthenticated user from /user to /login', () => {
    expect(resolveRedirect('/user', null)).toBe('/login');
    expect(resolveRedirect('/user/availability/abc', null)).toBe('/login');
  });

  it('redirects MANAGER away from /user to /manager', () => {
    expect(resolveRedirect('/user', SystemRole.MANAGER)).toBe('/manager');
    expect(resolveRedirect('/user/availability/abc', SystemRole.MANAGER)).toBe('/manager');
  });

  it('redirects ADMIN away from /user to /admin', () => {
    expect(resolveRedirect('/user', SystemRole.ADMIN)).toBe('/admin');
  });

  // /manager routes
  it('returns null (no redirect) when MANAGER accesses /manager routes', () => {
    expect(resolveRedirect('/manager', SystemRole.MANAGER)).toBeNull();
    expect(resolveRedirect('/manager/periods/new', SystemRole.MANAGER)).toBeNull();
    expect(resolveRedirect('/manager/guards', SystemRole.MANAGER)).toBeNull();
    expect(resolveRedirect('/manager/shibutz', SystemRole.MANAGER)).toBeNull();
  });

  it('redirects unauthenticated user from /manager to /login', () => {
    expect(resolveRedirect('/manager', null)).toBe('/login');
    expect(resolveRedirect('/manager/periods/new', null)).toBe('/login');
  });

  it('redirects EMPLOYEE away from /manager to /user', () => {
    expect(resolveRedirect('/manager', SystemRole.EMPLOYEE)).toBe('/user');
    expect(resolveRedirect('/manager/periods/new', SystemRole.EMPLOYEE)).toBe('/user');
  });

  it('redirects ADMIN away from /manager to /admin', () => {
    expect(resolveRedirect('/manager', SystemRole.ADMIN)).toBe('/admin');
  });

  // /admin routes
  it('returns null (no redirect) when ADMIN accesses /admin routes', () => {
    expect(resolveRedirect('/admin', SystemRole.ADMIN)).toBeNull();
    expect(resolveRedirect('/admin/courts', SystemRole.ADMIN)).toBeNull();
    expect(resolveRedirect('/admin/managers', SystemRole.ADMIN)).toBeNull();
    expect(resolveRedirect('/admin/guards', SystemRole.ADMIN)).toBeNull();
    expect(resolveRedirect('/admin/config', SystemRole.ADMIN)).toBeNull();
  });

  it('redirects unauthenticated user from /admin to /login', () => {
    expect(resolveRedirect('/admin', null)).toBe('/login');
    expect(resolveRedirect('/admin/config', null)).toBe('/login');
  });

  it('redirects EMPLOYEE away from /admin to /user', () => {
    expect(resolveRedirect('/admin', SystemRole.EMPLOYEE)).toBe('/user');
  });

  it('redirects MANAGER away from /admin to /manager', () => {
    expect(resolveRedirect('/admin', SystemRole.MANAGER)).toBe('/manager');
  });

  // Unrecognised paths pass through
  it('returns null for unrecognised paths (no redirect)', () => {
    expect(resolveRedirect('/some/unknown/path', SystemRole.MANAGER)).toBeNull();
    expect(resolveRedirect('/favicon.ico', null)).toBeNull();
  });
});
