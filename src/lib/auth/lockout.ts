export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export function isLocked(lockedUntil: Date | null, now: Date = new Date()): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

/** Next lockout state after a failed password attempt. */
export function nextFailureState(
  failedLoginCount: number,
  now: Date = new Date(),
): { failedLoginCount: number; lockedUntil: Date | null } {
  const count = failedLoginCount + 1;
  if (count >= MAX_FAILED_LOGINS) {
    return { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MS) };
  }
  return { failedLoginCount: count, lockedUntil: null };
}
