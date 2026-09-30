import type { ScheduleVersionStatus, SubmissionState } from '@/generated/prisma/client';

/** Display status composed from period submission state and the active version. */
export const PeriodScheduleStatus = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  LOCKED: 'LOCKED',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type PeriodScheduleStatus = (typeof PeriodScheduleStatus)[keyof typeof PeriodScheduleStatus];

export function periodScheduleStatus(input: {
  archivedAt?: Date | null;
  submissionState: SubmissionState;
  versions?: { status: ScheduleVersionStatus; isActive: boolean }[];
}): PeriodScheduleStatus {
  if (input.archivedAt) return PeriodScheduleStatus.ARCHIVED;
  if (input.versions?.some((version) => version.status === 'PUBLISHED' && version.isActive)) {
    return PeriodScheduleStatus.PUBLISHED;
  }
  if (input.submissionState === 'OPEN') return PeriodScheduleStatus.OPEN;
  if (input.submissionState === 'CLOSED') return PeriodScheduleStatus.LOCKED;
  return PeriodScheduleStatus.DRAFT;
}
