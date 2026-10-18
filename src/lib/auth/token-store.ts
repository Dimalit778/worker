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
  await prisma.$transaction(async (tx) => {
    // Serialize resends and redemption for this account, including different token kinds.
    const users = await tx.$queryRaw<{ id: string; isActive: boolean }[]>`
      SELECT id, "isActive" FROM "User" WHERE id=${userId} FOR UPDATE
    `;
    if (!users[0]?.isActive) throw new Error('החשבון אינו פעיל');
    await tx.verificationToken.deleteMany({ where: { identifier } });
    await tx.verificationToken.create({
      data: { identifier, token: hashToken(raw), expires: tokenExpiry(kind) },
    });
  });
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

/** Consume the link and save its password atomically; rollback keeps the link usable. */
export async function redeemPasswordToken(kind: TokenKind, raw: string, password: string): Promise<boolean> {
  // Keep expensive hashing outside the transaction, then recheck expiry and activity under lock.
  const userId = await peekToken(kind, raw);
  if (!userId) return false;
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<{ id: string; isActive: boolean }[]>`
      SELECT id, "isActive" FROM "User" WHERE id=${userId} FOR UPDATE
    `;
    if (!users[0]?.isActive) return false;
    const result = await tx.verificationToken.deleteMany({
      where: { identifier: tokenIdentifier(kind, userId), token: hashToken(raw), expires: { gt: new Date() } },
    });
    if (result.count !== 1) return false;
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    // A password change invalidates every outstanding invite/reset link for this account.
    await tx.verificationToken.deleteMany({
      where: { identifier: { in: [tokenIdentifier('invite', userId), tokenIdentifier('reset', userId)] } },
    });
    return true;
  });
}
