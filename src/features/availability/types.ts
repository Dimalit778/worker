import { PeriodScheduleStatus } from '@/features/schedules/period-status';
import type { ShiftType } from '@/generated/prisma/client';

export type PeriodInfo = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodScheduleStatus;
};

/** Slot rows for a submission; same shape expected by `availabilityEntriesToRecord`. */
export type AvailabilitySlotInfo = {
  date: Date;
  shiftType: ShiftType;
  isAvailable: boolean;
  preference?: 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE';
};

export type EmployeeAvailabilityForPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodScheduleStatus;
  isSubmitted: boolean;
  note: string;
  entries: AvailabilitySlotInfo[];
};
