import type { ScheduleStatus, ShiftType } from '@/generated/prisma/client';

export type PeriodInfo = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: ScheduleStatus;
};

/** Slot rows for a submission; same shape expected by `availabilityEntriesToRecord`. */
export type AvailabilitySlotInfo = {
  date: Date;
  shiftType: ShiftType;
  isAvailable: boolean;
};

export type EmployeeAvailabilityForPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: ScheduleStatus;
  isSubmitted: boolean;
  entries: AvailabilitySlotInfo[];
};
