import type { DayCategory, ScheduleStatus, ShiftType } from '@/generated/prisma/client';

export type ScheduleEmployeeOption = {
  id: string;
  name: string;
  position: {
    id: string;
    name: string;
  } | null;
};

export type ScheduleCapacityRule = {
  id: string;
  positionId: string;
  positionName: string;
  /** From `Position.displayOrder` — sort rows by this within a shift */
  positionDisplayOrder: number;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  amount: number;
  displayOrder: number;
};

export type AssignmentSummary = {
  id: string;
  employeeId: string;
  employeeName: string;
  positionId: string;
  positionName: string;
  shiftType: ShiftType;
  slotIndex: number;
};

/** Example: `2026-04-26-MORNING-<positionId>` */
export type AssignmentCellKey = `${string}-${ShiftType}-${string}`;

export type AssignmentMap = Record<AssignmentCellKey, AssignmentSummary[]>;

export type DraftScheduleFoundData = {
  found: true;
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  scheduleId: string | null;
  scheduleStatus: ScheduleStatus | null;
  courtId: string;
  employees: ScheduleEmployeeOption[];
  capacity: ScheduleCapacityRule[];
  assignments: AssignmentMap;
};

export type DraftScheduleNotFoundData = {
  found: false;
  message?: string;
};

export type DraftScheduleData = DraftScheduleFoundData | DraftScheduleNotFoundData;

/** Props for the week / shift schedule UI */
export type ScheduleProps = {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  scheduleId: string | null;
  scheduleStatus?: ScheduleStatus | null;
  assignments: AssignmentMap;
  employees: ScheduleEmployeeOption[];
  capacity: ScheduleCapacityRule[];
  courtId: string;
  readonly?: boolean;
};

export type WeekDay = {
  iso: string;
  dayOfWeek: number;
  letter: string;
  label: string;
};

export type AssignEmployeeToSlotParams = {
  scheduleId: string | null;
  periodId: string;
  employeeId: string;
  courtId: string;
  positionId: string;
  shiftType: ShiftType;
  date: string;
  slotIndex: number;
};
