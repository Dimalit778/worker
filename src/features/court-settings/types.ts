import type { DayCategory, Position, ScheduleStatus, ShiftType } from '@/generated/prisma/client';
import type { AssignmentMap } from '../shift-assignments/types';

export type { ShiftType };

export type GuardOption = {
  id: string;
  name: string;
};
export type PositionCapacityMap = Partial<Record<string, number>>;

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
