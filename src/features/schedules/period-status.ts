import type { ScheduleStatus } from '@/generated/prisma/client';

/** Display status composed from the schedule status and its submission window. */
export const PeriodScheduleStatus = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  LOCKED: 'LOCKED',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type PeriodScheduleStatus = (typeof PeriodScheduleStatus)[keyof typeof PeriodScheduleStatus];

export function periodScheduleStatus(
  schedule: {
    status: ScheduleStatus;
    submissionOpensAt: Date;
    submissionClosesAt: Date;
  },
  now = new Date(),
): PeriodScheduleStatus {
  if (schedule.status === 'ARCHIVED') return PeriodScheduleStatus.ARCHIVED;
  if (schedule.status === 'PUBLISHED') return PeriodScheduleStatus.PUBLISHED;
  if (now >= schedule.submissionOpensAt && now < schedule.submissionClosesAt) return PeriodScheduleStatus.OPEN;
  if (now >= schedule.submissionClosesAt) return PeriodScheduleStatus.LOCKED;
  return PeriodScheduleStatus.DRAFT;
}
