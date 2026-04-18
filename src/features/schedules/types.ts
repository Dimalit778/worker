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
