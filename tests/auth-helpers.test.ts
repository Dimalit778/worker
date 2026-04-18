import { describe, it, expect } from 'vitest'
import { hasRole, isEmployee, isManager, isAdmin, isManagerOrAdmin } from '@/lib/auth-helpers'
import type { Session } from 'next-auth'
import { SystemRole } from '@/generated/prisma/client'

const makeSession = (systemRole: SystemRole): Session => ({
  user: {
    id: 'user-1',
    name: 'Test',
    email: 'test@test.com',
    systemRole,
    primaryCourtId: null,
    employeeNumber: null,
    mustChangePassword: false,
  },
  expires: new Date(Date.now() + 86400_000).toISOString(),
})

describe('hasRole', () => {
  it('returns true when session role matches', () => {
    expect(hasRole(makeSession(SystemRole.EMPLOYEE), SystemRole.EMPLOYEE)).toBe(true)
    expect(hasRole(makeSession(SystemRole.MANAGER), SystemRole.MANAGER)).toBe(true)
    expect(hasRole(makeSession(SystemRole.ADMIN), SystemRole.ADMIN)).toBe(true)
  })

  it('returns false when roles do not match', () => {
    expect(hasRole(makeSession(SystemRole.EMPLOYEE), SystemRole.MANAGER)).toBe(false)
    expect(hasRole(makeSession(SystemRole.ADMIN), SystemRole.EMPLOYEE)).toBe(false)
  })

  it('returns false for null session', () => {
    expect(hasRole(null, SystemRole.EMPLOYEE)).toBe(false)
  })
})

describe('isEmployee', () => {
  it('returns true for EMPLOYEE session', () => {
    expect(isEmployee(makeSession(SystemRole.EMPLOYEE))).toBe(true)
  })

  it('returns false for MANAGER session', () => {
    expect(isEmployee(makeSession(SystemRole.MANAGER))).toBe(false)
  })

  it('returns false for ADMIN session', () => {
    expect(isEmployee(makeSession(SystemRole.ADMIN))).toBe(false)
  })
})

describe('isManager', () => {
  it('returns true for MANAGER session', () => {
    expect(isManager(makeSession(SystemRole.MANAGER))).toBe(true)
  })

  it('returns false for EMPLOYEE session', () => {
    expect(isManager(makeSession(SystemRole.EMPLOYEE))).toBe(false)
  })

  it('returns false for ADMIN session', () => {
    expect(isManager(makeSession(SystemRole.ADMIN))).toBe(false)
  })
})

describe('isAdmin', () => {
  it('returns true for ADMIN session', () => {
    expect(isAdmin(makeSession(SystemRole.ADMIN))).toBe(true)
  })

  it('returns false for MANAGER session', () => {
    expect(isAdmin(makeSession(SystemRole.MANAGER))).toBe(false)
  })

  it('returns false for EMPLOYEE session', () => {
    expect(isAdmin(makeSession(SystemRole.EMPLOYEE))).toBe(false)
  })

  it('returns false for null session', () => {
    expect(isAdmin(null)).toBe(false)
  })
})

describe('isManagerOrAdmin', () => {
  it('returns true for MANAGER session', () => {
    expect(isManagerOrAdmin(makeSession(SystemRole.MANAGER))).toBe(true)
  })

  it('returns true for ADMIN session', () => {
    expect(isManagerOrAdmin(makeSession(SystemRole.ADMIN))).toBe(true)
  })

  it('returns false for EMPLOYEE session', () => {
    expect(isManagerOrAdmin(makeSession(SystemRole.EMPLOYEE))).toBe(false)
  })

  it('returns false for null session', () => {
    expect(isManagerOrAdmin(null)).toBe(false)
  })
})
