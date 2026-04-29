import type { PeriodStatus } from '@/generated/prisma/client';

export type PeriodSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  status: PeriodStatus;
  submittedCount: number;
  totalGuards: number;
};

export type PeriodType = 'weekly' | 'biweekly';
