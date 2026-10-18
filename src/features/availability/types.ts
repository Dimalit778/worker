import { PeriodScheduleStatus } from '@/features/schedules/period-status';
import type { ShiftType } from '@/generated/prisma/client';
import type { AvailabilityStatus, PreferenceMap } from './utils';

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
  submissionStatus: AvailabilityStatus;
  closesAt: string;
  submittedAt: string | null;
  isSubmitted: boolean;
  /** Submitted note only. */
  note: string;
  /** Submitted entries only (never the draft). */
  entries: AvailabilitySlotInfo[];
};

export type CurrentAvailability = {
  period: PeriodInfo | null;
  /** Entries to edit: the saved draft if any, otherwise the submitted entries. */
  entries: PreferenceMap;
  submittedEntries: PreferenceMap;
  isSubmitted: boolean;
  note: string;
  submittedNote: string;
  status: AvailabilityStatus;
  closesAt: string | null;
  lastSavedAt: string | null;
  submittedAt: string | null;
  /** When no period is open: the next scheduled opening, if any. */
  nextOpeningAt: string | null;
};
