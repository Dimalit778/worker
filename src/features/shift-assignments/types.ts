// export type AssignmentSummary = {
//   id: string;
//   employeeId: string;
//   employeeName: string;
//   positionId: string;
//   positionName: string;
//   shiftType: ShiftType;
//   slotIndex: number;
// };
// export type ScheduleData = {
//   periodId: string;
//   periodName: string;
//   startDate: string;
//   endDate: string;
//   scheduleId: string | null;
//   scheduleStatus: ScheduleStatus | null;
//   assignments: AssignmentMap;
//   guards: { id: string; name: string; position: Position }[];
//   capacity: { default: {}; friday: {}; saturday: {} };
//   courtId: string;
// };
// export type AssignGuardParams = {
//   scheduleId: string | null;
//   periodId: string;
//   employeeId: string;
//   courtId: string;
//   courtShiftRoleId: string;
//   date: string;
//   slotIndex: number;
// };

// export type AssignmentMap = Record<string, AssignmentSummary[]>;

// export type ScheduleProps = {
//   periodId: string;
//   periodName: string;
//   startDate: string;
//   endDate: string;
//   scheduleId: string | null;
//   assignments: AssignmentMap;
//   guards: { id: string; name: string }[];
//   capacity: FullCapacityRules;
//   courtId: string;
//   readonly?: boolean;
// };

// export type WeekDay = {
//   iso: string;
//   dayOfWeek: number;
//   letter: string;
//   label: string;
// };

// export type DisplayRow = {
//   key: string;
//   label: string;
//   position: Position;
//   slotIndex: number;
//   roleSlotIndex: number;
//   isGroupStart: boolean;
// };
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

export type AssignmentCellKey = `${string}-${ShiftType}-${string}`;

/**
 * key example:
 * 2026-04-26-MORNING-cmoh_position_id
 */
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
