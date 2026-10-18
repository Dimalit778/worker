import type { ScheduleStatus } from '@/generated/prisma/client';

export const EXTENSION_REASON_PREFIX = 'הארכת מועד הגשה: ';
export const EXTENSION_REASON_MAX = 500;

type ExtensionTarget = {
  status: ScheduleStatus;
  publishedVersionId: string | null;
  periodStart: Date;
};

/** A deadline can be extended only before the schedule is published and before the period starts. */
export function canExtendDeadline(schedule: ExtensionTarget, now = new Date()): boolean {
  return schedule.status === 'DRAFT' && !schedule.publishedVersionId && now < schedule.periodStart;
}

/** Returns a Hebrew error for an invalid extension request, or null when it is allowed. */
export function extensionError(input: ExtensionTarget & {
  opensAt: Date;
  closesAt: Date;
  newDeadline: Date | null;
  reason: string;
  now: Date;
}): string | null {
  if (!canExtendDeadline(input, input.now)) return 'אפשר להאריך את מועד ההגשה רק לפני פרסום השיבוץ';
  const reason = input.reason.trim();
  if (!reason) return 'יש לציין סיבה להארכה';
  if (reason.length > EXTENSION_REASON_MAX) return `הסיבה ארוכה מדי (עד ${EXTENSION_REASON_MAX} תווים)`;
  const deadline = input.newDeadline;
  if (!deadline) return 'המועד החדש לא תקין';
  if (deadline <= input.now) return 'המועד החדש כבר עבר';
  if (deadline <= input.closesAt) return 'המועד החדש חייב להיות אחרי מועד ההגשה הנוכחי';
  if (deadline <= input.opensAt) return 'המועד החדש חייב להיות אחרי פתיחת ההגשה';
  if (deadline >= input.periodStart) return 'מועד ההגשה חייב להיות לפני תחילת התקופה';
  return null;
}
