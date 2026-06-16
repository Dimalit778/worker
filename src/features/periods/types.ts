import type { ScheduleStatus } from '@/generated/prisma/client';

export type PeriodSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  status: ScheduleStatus;
  submittedCount: number;
  totalEmployees: number;
};

export type PeriodType = 'weekly' | 'biweekly';
