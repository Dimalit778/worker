'use server';

import { prisma } from '@/lib/db/client';
import { buildAuthLink, sendResetEmail } from '@/lib/auth/emails';
import { consumeToken, issueToken, peekToken, setPasswordAndUnlock } from '@/lib/auth/token-store';
import { validateNewPassword } from '@/lib/auth/password';

type Result = { ok: true } | { error: string };

const INVALID_LINK = 'הקישור אינו תקף או שפג תוקפו';

export async function isAuthTokenValid(kind: 'invite' | 'reset', token: string): Promise<boolean> {
  return (await peekToken(kind, token)) !== null;
}

export async function acceptInvite(token: string, password: string, confirm: string): Promise<Result> {
  const passwordError = validateNewPassword(password, confirm);
  if (passwordError) return { error: passwordError };

  const userId = await consumeToken('invite', token);
  if (!userId) return { error: INVALID_LINK };

  await setPasswordAndUnlock(userId, password);
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
        const raw = await issueToken('reset', user.id);
        await sendResetEmail(user.email, buildAuthLink(`/reset-password/${raw}`));
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

  const userId = await consumeToken('reset', token);
  if (!userId) return { error: INVALID_LINK };

  await setPasswordAndUnlock(userId, password);
  return { ok: true };
}
