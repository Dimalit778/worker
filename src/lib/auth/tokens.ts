import { createHash, randomBytes } from 'node:crypto';

export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;

export type TokenKind = 'invite' | 'reset';

export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function tokenIdentifier(kind: TokenKind, userId: string): string {
  return `${kind}:${userId}`;
}

export function userIdFromIdentifier(kind: TokenKind, identifier: string): string | null {
  const prefix = `${kind}:`;
  return identifier.startsWith(prefix) ? identifier.slice(prefix.length) || null : null;
}

export function tokenExpiry(kind: TokenKind, now: Date = new Date()): Date {
  return new Date(now.getTime() + (kind === 'invite' ? INVITE_TTL_MS : RESET_TTL_MS));
}

export function isTokenExpired(expires: Date, now: Date = new Date()): boolean {
  return expires.getTime() <= now.getTime();
}
