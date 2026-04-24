import { PeriodStatus } from '@/generated/prisma/client';

export type PeriodInfo = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
};
