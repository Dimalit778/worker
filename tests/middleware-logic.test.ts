import { describe, it, expect } from 'vitest'
import { resolveRedirect } from '@/lib/middleware-logic'
import { Role } from '@/generated/prisma/client'

describe('resolveRedirect', () => {
  // Public routes
  it('returns null for /login (public route)', () => {
    expect(resolveRedirect('/login', null)).toBeNull()
  })

  it('returns null for /api/auth routes', () => {
    expect(resolveRedirect('/api/auth/session', null)).toBeNull()
    expect(resolveRedirect('/api/auth/callback/credentials', null)).toBeNull()
  })

  // Root redirect
  it('redirects unauthenticated user from / to /login', () => {
    expect(resolveRedirect('/', null)).toBe('/login')
  })

  it('redirects GUARD from / to /user', () => {
    expect(resolveRedirect('/', Role.GUARD)).toBe('/user')
  })

  it('redirects MANAGER from / to /manager', () => {
    expect(resolveRedirect('/', Role.MANAGER)).toBe('/manager')
  })

  it('redirects ADMIN from / to /admin', () => {
    expect(resolveRedirect('/', Role.ADMIN)).toBe('/admin')
  })

  // /user routes
  it('returns null (no redirect) when GUARD accesses /user routes', () => {
    expect(resolveRedirect('/user', Role.GUARD)).toBeNull()
    expect(resolveRedirect('/user/availability/abc', Role.GUARD)).toBeNull()
    expect(resolveRedirect('/user/schedule/xyz', Role.GUARD)).toBeNull()
  })

  it('redirects unauthenticated user from /user to /login', () => {
    expect(resolveRedirect('/user', null)).toBe('/login')
    expect(resolveRedirect('/user/availability/abc', null)).toBe('/login')
  })

  it('redirects MANAGER away from /user to /manager', () => {
    expect(resolveRedirect('/user', Role.MANAGER)).toBe('/manager')
    expect(resolveRedirect('/user/availability/abc', Role.MANAGER)).toBe('/manager')
  })

  it('redirects ADMIN away from /user to /admin', () => {
    expect(resolveRedirect('/user', Role.ADMIN)).toBe('/admin')
  })

  // /manager routes
  it('returns null (no redirect) when MANAGER accesses /manager routes', () => {
    expect(resolveRedirect('/manager', Role.MANAGER)).toBeNull()
    expect(resolveRedirect('/manager/periods/new', Role.MANAGER)).toBeNull()
    expect(resolveRedirect('/manager/guards', Role.MANAGER)).toBeNull()
  })

  it('redirects unauthenticated user from /manager to /login', () => {
    expect(resolveRedirect('/manager', null)).toBe('/login')
    expect(resolveRedirect('/manager/periods/new', null)).toBe('/login')
  })

  it('redirects GUARD away from /manager to /user', () => {
    expect(resolveRedirect('/manager', Role.GUARD)).toBe('/user')
    expect(resolveRedirect('/manager/periods/new', Role.GUARD)).toBe('/user')
  })

  it('redirects ADMIN away from /manager to /admin', () => {
    expect(resolveRedirect('/manager', Role.ADMIN)).toBe('/admin')
  })

  // /admin routes
  it('returns null (no redirect) when ADMIN accesses /admin routes', () => {
    expect(resolveRedirect('/admin', Role.ADMIN)).toBeNull()
    expect(resolveRedirect('/admin/courts', Role.ADMIN)).toBeNull()
    expect(resolveRedirect('/admin/managers', Role.ADMIN)).toBeNull()
    expect(resolveRedirect('/admin/guards', Role.ADMIN)).toBeNull()
    expect(resolveRedirect('/admin/config', Role.ADMIN)).toBeNull()
  })

  it('redirects unauthenticated user from /admin to /login', () => {
    expect(resolveRedirect('/admin', null)).toBe('/login')
    expect(resolveRedirect('/admin/config', null)).toBe('/login')
  })

  it('redirects GUARD away from /admin to /user', () => {
    expect(resolveRedirect('/admin', Role.GUARD)).toBe('/user')
  })

  it('redirects MANAGER away from /admin to /manager', () => {
    expect(resolveRedirect('/admin', Role.MANAGER)).toBe('/manager')
  })

  // Unrecognised paths pass through
  it('returns null for unrecognised paths (no redirect)', () => {
    expect(resolveRedirect('/some/unknown/path', Role.MANAGER)).toBeNull()
    expect(resolveRedirect('/favicon.ico', null)).toBeNull()
  })
})
