import { PeriodScheduleStatus } from '@/features/schedules/period-status';

export type PeriodSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  status: PeriodScheduleStatus;
  submittedCount: number;
  totalEmployees: number;
};

export type PeriodType = 'weekly' | 'biweekly';
