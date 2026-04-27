import type { Position } from '@/generated/prisma/client';
import type { EmployeeSummary, FullCapacityRules } from '../court-settings/types';

export type AssignmentSummary = {
  id: string;
  employeeId: string;
  employeeName: string;
  courtShiftRoleId: string;
  roleName: string;
  roleCode: string;
  slotIndex: number;
};

export type AssignGuardParams = {
  scheduleId: string | null;
  periodId: string;
  employeeId: string;
  courtId: string;
  courtShiftRoleId: string;
  date: string;
  slotIndex: number;
};

export type AssignmentMap = Record<string, AssignmentSummary[]>;

export type ScheduleProps = {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  scheduleId: string | null;
  assignments: AssignmentMap;
  guards: { id: string; name: string }[];
  capacity: FullCapacityRules;
  courtId: string;
  readonly?: boolean;
};

export type WeekDay = {
  iso: string;
  dayOfWeek: number;
  letter: string;
  label: string;
};

export type SchedulePageData = {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  scheduleId: string | null;
  assignments: AssignmentMap;
  guards: EmployeeSummary[];
  capacity: FullCapacityRules;
  courtId: string;
};

export type DisplayRow = {
  key: string;
  label: string;
  position: Position;
  slotIndex: number;
  roleSlotIndex: number;
  isGroupStart: boolean;
};
