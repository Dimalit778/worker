import { describe, it, expect } from 'vitest'
import { hasRole, isGuard, isManager } from '@/lib/auth-helpers'
import type { Session } from 'next-auth'
import { Role } from '@prisma/client'

const makeSession = (role: Role): Session => ({
  user: { id: 'user-1', name: 'Test', email: 'test@test.com', role, primaryCourtId: null },
  expires: new Date(Date.now() + 86400_000).toISOString(),
})

describe('hasRole', () => {
  it('returns true when session role matches', () => {
    expect(hasRole(makeSession(Role.GUARD), Role.GUARD)).toBe(true)
    expect(hasRole(makeSession(Role.MANAGER), Role.MANAGER)).toBe(true)
  })

  it('returns false when roles do not match', () => {
    expect(hasRole(makeSession(Role.GUARD), Role.MANAGER)).toBe(false)
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
})

describe('isManager', () => {
  it('returns true for MANAGER session', () => {
    expect(isManager(makeSession(Role.MANAGER))).toBe(true)
  })

  it('returns false for GUARD session', () => {
    expect(isManager(makeSession(Role.GUARD))).toBe(false)
  })
})
