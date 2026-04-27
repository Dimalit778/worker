import type { DayCategory, Position, ScheduleStatus, ShiftType } from '@/generated/prisma/client';
import type { AssignmentMap } from '../shift-assignments/types';

export type { ShiftType };

export type EmployeeSummary = {
  id: string;
  name: string;
};
export type PositionCapacityMap = Partial<Record<Position, number>>;

export type CapacityMap = Record<ShiftType, PositionCapacityMap>;

export type FullCapacityRules = {
  default: CapacityMap;
  friday: CapacityMap;
  saturday: CapacityMap;
};
export type CourtShiftRoleWithRules = {
  id: string;
  code: string;
  name: string;
  shiftType: ShiftType;
  isActive: boolean;
  displayOrder: number;
  staffingRules: {
    id: string;
    dayCategory: DayCategory;
    requiredCount: number;
  }[];
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

export type StaffingRuleRow = {
  id: string;
  dayCategory: DayCategory;
  requiredCount: number;
};
