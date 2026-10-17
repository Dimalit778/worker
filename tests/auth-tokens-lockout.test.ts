import { describe, expect, it } from 'vitest';
import {
  INVITE_TTL_MS,
  RESET_TTL_MS,
  generateRawToken,
  hashToken,
  isTokenExpired,
  tokenExpiry,
  tokenIdentifier,
  userIdFromIdentifier,
} from '@/lib/auth/tokens';
import { LOCKOUT_MS, isLocked, nextFailureState } from '@/lib/auth/lockout';
import { validateNewPassword } from '@/lib/auth/password';

describe('auth tokens', () => {
  it('hashes deterministically and never returns the raw token', () => {
    const raw = generateRawToken();
    expect(raw).toHaveLength(64);
    expect(hashToken(raw)).toBe(hashToken(raw));
    expect(hashToken(raw)).not.toBe(raw);
    expect(generateRawToken()).not.toBe(raw);
  });

  it('round-trips identifiers per kind', () => {
    expect(tokenIdentifier('invite', 'u1')).toBe('invite:u1');
    expect(userIdFromIdentifier('invite', 'invite:u1')).toBe('u1');
    expect(userIdFromIdentifier('reset', 'invite:u1')).toBeNull();
    expect(userIdFromIdentifier('reset', 'reset:')).toBeNull();
  });

  it('uses 72h for invites and 1h for resets', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(tokenExpiry('invite', now).getTime() - now.getTime()).toBe(INVITE_TTL_MS);
    expect(tokenExpiry('reset', now).getTime() - now.getTime()).toBe(RESET_TTL_MS);
    expect(isTokenExpired(tokenExpiry('reset', now), new Date(now.getTime() + RESET_TTL_MS - 1))).toBe(false);
    expect(isTokenExpired(tokenExpiry('reset', now), new Date(now.getTime() + RESET_TTL_MS))).toBe(true);
  });
});

describe('login lockout', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('detects active lock', () => {
    expect(isLocked(null, now)).toBe(false);
    expect(isLocked(new Date(now.getTime() + 1), now)).toBe(true);
    expect(isLocked(new Date(now.getTime()), now)).toBe(false);
  });

  it('increments until the 5th failure, then locks for 15 minutes and resets count', () => {
    expect(nextFailureState(0, now)).toEqual({ failedLoginCount: 1, lockedUntil: null });
    expect(nextFailureState(3, now)).toEqual({ failedLoginCount: 4, lockedUntil: null });
    expect(nextFailureState(4, now)).toEqual({
      failedLoginCount: 0,
      lockedUntil: new Date(now.getTime() + LOCKOUT_MS),
    });
  });
});

describe('validateNewPassword', () => {
  it('enforces length and confirmation', () => {
    expect(validateNewPassword('short', 'short')).not.toBeNull();
    expect(validateNewPassword('longenough', 'different1')).not.toBeNull();
    expect(validateNewPassword('longenough', 'longenough')).toBeNull();
  });
});
