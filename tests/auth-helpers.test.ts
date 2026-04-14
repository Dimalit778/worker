import { describe, it, expect } from 'vitest'
import { hasRole, isGuard, isManager, isAdmin, isManagerOrAdmin } from '@/lib/auth-helpers'
import type { Session } from 'next-auth'
import { Role } from '@/generated/prisma/client'

const makeSession = (role: Role): Session => ({
  user: { id: 'user-1', name: 'Test', email: 'test@test.com', role, primaryCourtId: null },
  expires: new Date(Date.now() + 86400_000).toISOString(),
})

describe('hasRole', () => {
  it('returns true when session role matches', () => {
    expect(hasRole(makeSession(Role.GUARD), Role.GUARD)).toBe(true)
    expect(hasRole(makeSession(Role.MANAGER), Role.MANAGER)).toBe(true)
    expect(hasRole(makeSession(Role.ADMIN), Role.ADMIN)).toBe(true)
  })

  it('returns false when roles do not match', () => {
    expect(hasRole(makeSession(Role.GUARD), Role.MANAGER)).toBe(false)
    expect(hasRole(makeSession(Role.ADMIN), Role.GUARD)).toBe(false)
  })

  it('returns false for null session', () => {
    expect(hasRole(null, Role.GUARD)).toBe(false)
  })
})

describe('isGuard', () => {
  it('returns true for GUARD session', () => {
    expect(isGuard(makeSession(Role.GUARD))).toBe(true)
  })

  it('returns false for MANAGER session', () => {
    expect(isGuard(makeSession(Role.MANAGER))).toBe(false)
  })

  it('returns false for ADMIN session', () => {
    expect(isGuard(makeSession(Role.ADMIN))).toBe(false)
  })
})

describe('isManager', () => {
  it('returns true for MANAGER session', () => {
    expect(isManager(makeSession(Role.MANAGER))).toBe(true)
  })

  it('returns false for GUARD session', () => {
    expect(isManager(makeSession(Role.GUARD))).toBe(false)
  })

  it('returns false for ADMIN session', () => {
    expect(isManager(makeSession(Role.ADMIN))).toBe(false)
  })
})

describe('isAdmin', () => {
  it('returns true for ADMIN session', () => {
    expect(isAdmin(makeSession(Role.ADMIN))).toBe(true)
  })

  it('returns false for MANAGER session', () => {
    expect(isAdmin(makeSession(Role.MANAGER))).toBe(false)
  })

  it('returns false for GUARD session', () => {
    expect(isAdmin(makeSession(Role.GUARD))).toBe(false)
  })

  it('returns false for null session', () => {
    expect(isAdmin(null)).toBe(false)
  })
})

describe('isManagerOrAdmin', () => {
  it('returns true for MANAGER session', () => {
    expect(isManagerOrAdmin(makeSession(Role.MANAGER))).toBe(true)
  })

  it('returns true for ADMIN session', () => {
    expect(isManagerOrAdmin(makeSession(Role.ADMIN))).toBe(true)
  })

  it('returns false for GUARD session', () => {
    expect(isManagerOrAdmin(makeSession(Role.GUARD))).toBe(false)
  })

  it('returns false for null session', () => {
    expect(isManagerOrAdmin(null)).toBe(false)
  })
})
