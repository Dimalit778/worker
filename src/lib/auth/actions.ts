'use server';

import { prisma } from '@/lib/db/client';
import { buildAuthLink, sendResetEmail } from '@/lib/auth/emails';
import { redeemPasswordToken, issueToken, peekToken } from '@/lib/auth/token-store';
import { RESET_TTL_MS, tokenIdentifier } from '@/lib/auth/tokens';
import { validateNewPassword } from '@/lib/auth/password';

type Result = { ok: true } | { error: string };

const INVALID_LINK = 'הקישור אינו תקף או שפג תוקפו';
const RESET_COOLDOWN_MS = 60 * 1000;

export async function isAuthTokenValid(kind: 'invite' | 'reset', token: string): Promise<boolean> {
  return (await peekToken(kind, token)) !== null;
}

export async function acceptInvite(token: string, password: string, confirm: string): Promise<Result> {
  const passwordError = validateNewPassword(password, confirm);
  if (passwordError) return { error: passwordError };

  if (!(await redeemPasswordToken('invite', token, password))) return { error: INVALID_LINK };
  return { ok: true };
}

/** Always resolves with ok to avoid revealing whether the email exists. */
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const normalized = email.trim().toLowerCase();
  if (normalized.includes('@')) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: normalized },
        select: { id: true, email: true, isActive: true },
      });
      if (user?.isActive) {
        // A link issued in the last minute is still live: don't resend or invalidate it.
        const recent = await prisma.verificationToken.findFirst({
          where: {
            identifier: tokenIdentifier('reset', user.id),
            expires: { gt: new Date(Date.now() + RESET_TTL_MS - RESET_COOLDOWN_MS) },
          },
          select: { identifier: true },
        });
        if (!recent) {
          const raw = await issueToken('reset', user.id);
          const sent = await sendResetEmail(user.email, buildAuthLink(`/reset-password/${raw}`));
          if (!sent.ok) console.error('requestPasswordReset email failed', sent.error);
        }
      }
    } catch (error) {
      console.error('requestPasswordReset failed', error);
    }
  }
  return { ok: true };
}

export async function resetPassword(token: string, password: string, confirm: string): Promise<Result> {
  const passwordError = validateNewPassword(password, confirm);
  if (passwordError) return { error: passwordError };

  if (!(await redeemPasswordToken('reset', token, password))) return { error: INVALID_LINK };
  return { ok: true };
}
