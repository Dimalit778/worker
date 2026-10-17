import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/client';
import {
  generateRawToken,
  hashToken,
  isTokenExpired,
  tokenExpiry,
  tokenIdentifier,
  userIdFromIdentifier,
  type TokenKind,
} from '@/lib/auth/tokens';

/** Issues a new one-time token for the user, deleting any older one. Returns the raw token. */
export async function issueToken(kind: TokenKind, userId: string): Promise<string> {
  const identifier = tokenIdentifier(kind, userId);
  const raw = generateRawToken();
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: hashToken(raw), expires: tokenExpiry(kind) },
    }),
  ]);
  return raw;
}

/** Returns the user id if the raw token is valid (does not consume it). */
export async function peekToken(kind: TokenKind, raw: string): Promise<string | null> {
  const row = await prisma.verificationToken.findUnique({ where: { token: hashToken(raw) } });
  if (!row) return null;
  const userId = userIdFromIdentifier(kind, row.identifier);
  if (!userId || isTokenExpired(row.expires)) return null;
  return userId;
}

/** Validates and deletes the token (one-time use). Returns the user id or null. */
export async function consumeToken(kind: TokenKind, raw: string): Promise<string | null> {
  const userId = await peekToken(kind, raw);
  if (!userId) return null;
  const { count } = await prisma.verificationToken.deleteMany({ where: { token: hashToken(raw) } });
  return count === 1 ? userId : null;
}

export async function setPasswordAndUnlock(userId: string, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
  });
}
