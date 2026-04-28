import { AvailabilityEntry, PeriodStatus } from '@/generated/prisma/client';

export type PeriodInfo = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
};

export type EmployeeAvailabilityForPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  isSubmitted: boolean;
  entries: AvailabilityEntry[];
};
