import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { buildAuthLink, sendInviteEmail } from '@/lib/auth/emails';
import { issueToken } from '@/lib/auth/token-store';

export type InviteResult = { inviteLink: string; emailError?: string };

/** Hash of random bytes nobody knows; the user sets a real password via the invite link. */
export function unusablePasswordHash(): Promise<string> {
  return bcrypt.hash(randomBytes(32).toString('hex'), 12);
}

export async function sendInvite(userId: string, email: string): Promise<InviteResult> {
  const raw = await issueToken('invite', userId);
  const inviteLink = buildAuthLink(`/invite/${raw}`);
  const sent = await sendInviteEmail(email, inviteLink);
  return sent.ok ? { inviteLink } : { inviteLink, emailError: sent.error };
}
