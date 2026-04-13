import { describe, it, expect } from 'vitest'
import { resolveRedirect } from '@/lib/middleware-logic'
import { Role } from '@prisma/client'

describe('resolveRedirect', () => {
  it('returns null for /login (public route)', () => {
    expect(resolveRedirect('/login', null)).toBeNull()
  })

  it('returns /login when no session on protected route', () => {
    expect(resolveRedirect('/guard', null)).toBe('/login')
    expect(resolveRedirect('/manager', null)).toBe('/login')
    expect(resolveRedirect('/manager/periods/new', null)).toBe('/login')
  })

  it('allows GUARD on /guard routes', () => {
    expect(resolveRedirect('/guard', Role.GUARD)).toBeNull()
    expect(resolveRedirect('/guard/availability/abc', Role.GUARD)).toBeNull()
  })

  it('redirects GUARD away from /manager routes', () => {
    expect(resolveRedirect('/manager', Role.GUARD)).toBe('/guard')
    expect(resolveRedirect('/manager/admin/courts', Role.GUARD)).toBe('/guard')
  })

  it('allows MANAGER on /manager routes', () => {
    expect(resolveRedirect('/manager', Role.MANAGER)).toBeNull()
    expect(resolveRedirect('/manager/admin/courts', Role.MANAGER)).toBeNull()
  })

  it('redirects MANAGER away from /guard routes', () => {
    expect(resolveRedirect('/guard', Role.MANAGER)).toBe('/manager')
  })

  it('redirects authenticated GUARD from / to /guard', () => {
    expect(resolveRedirect('/', Role.GUARD)).toBe('/guard')
  })

  it('redirects authenticated MANAGER from / to /manager', () => {
    expect(resolveRedirect('/', Role.MANAGER)).toBe('/manager')
  })

  it('redirects unauthenticated user from / to /login', () => {
    expect(resolveRedirect('/', null)).toBe('/login')
  })
})
