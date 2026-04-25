import type { DayCategory, Position, ScheduleStatus, ShiftType } from '@/generated/prisma/client';
import type { AssignmentMap } from '../shift-assignments/types';

export type { ShiftType };

export type EmployeeSummary = {
  id: string;
  name: string;
};

/** Max slots to display per shift type */
export type CapacityMap = { MORNING: number; EVENING: number; NIGHT: number };

/**
 * Full capacity rules: default (all regular days), plus optional overrides
 * for Friday (dayOfWeek=5) and Saturday (dayOfWeek=6).
 * A value of 0 means that shift is closed on that day.
 */
export type FullCapacityRules = {
  default: CapacityMap;
  friday: CapacityMap;
  saturday: CapacityMap;
};
export type DraftScheduleData =
  | { found: false }
  | {
      found: true;
      periodId: string;
      periodName: string;
      startDate: string;
      endDate: string;
      scheduleId: string | null;
      scheduleStatus: ScheduleStatus | null;
      assignments: AssignmentMap;
      guards: EmployeeSummary[];
      capacity: FullCapacityRules;
      courtId: string;
    };

export type CourtStaffRuleRow = {
  id: string;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  position: import('@/generated/prisma/client').Position;
  requiredCount: number;
  displayOrder: number;
};

export type CourtShiftRoleRow = {
  id: string;
  code: string;
  name: string;
  shiftType: ShiftType;
  isActive: boolean;
  displayOrder: number;
};
