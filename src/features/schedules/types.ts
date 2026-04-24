import { PeriodStatus } from '@/generated/prisma/client';

export type CurrentSchedulingPeriodSummary = {
  name: string;
  startDate: Date;
  endDate: Date;
  submissionDeadline: Date;
  status: PeriodStatus;
};

export type CurrentPeriodPanelProps = {
  period: CurrentSchedulingPeriodSummary | null;
};
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
