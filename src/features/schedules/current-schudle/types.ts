import type { ReactNode } from 'react';
import type { ShiftType } from '@/generated/prisma/client';
import type {
  AssignmentMap,
  AssignmentSummary,
  OverflowCandidateMap,
  OverflowCandidateSummary,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
} from '@/features/schedules/types';

export type CurrentScheduleViewProps = {
  scheduleId: string;
  startDate: string;
  endDate: string;
  scheduleName: string;
  assignments: AssignmentMap;
  overflowCandidates?: OverflowCandidateMap;
  employees: ScheduleEmployeeOption[];
  capacity: ScheduleCapacityRule[];
  courtId: string;
  currentEmployeeId?: string | null;
  readonly?: boolean;
};

export type DayOption = {
  iso: string;
  dayName: string;
  dateLabel: string;
  isToday: boolean;
};

export type ShiftSlot = {
  key: string;
  positionId: string;
  positionName: string;
  positionCode: number;
  positionColor: string | null;
  slotIndex: number;
  requiredCount: number;
  assignment: AssignmentSummary | null;
  overflowCandidates: OverflowCandidateSummary[];
};

export type ShiftDisplay = {
  shiftType: ShiftType;
  label: string;
  time: string;
  tone: string;
  icon: ReactNode;
};
