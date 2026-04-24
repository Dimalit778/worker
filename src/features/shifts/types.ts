import type { DayCategory, Position, ScheduleStatus, ShiftType } from '@/generated/prisma/client';

export type { ShiftType };

export type GuardSummary = {
  id: string;
  name: string;
};

export type AssignmentSummary = {
  id: string;
  userId: string;
  userName: string;
  isOpeningDuty: boolean;
};

export type AssignGuardParams = {
  scheduleId: string | null;
  periodId: string;
  userId: string;
  courtId: string;
  date: string;
  shiftType: ShiftType;
  position: Position;
  slotIndex: number;
  isOpeningDuty: boolean;
};

/**
 * Key: `${isoDate}-${shiftType}`  e.g. "2024-03-22-MORNING"
 * Value: assignments sorted by creation order (slot 0 first)
 */
export type AssignmentMap = Record<string, AssignmentSummary[]>;

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

export type ShiftsGridProps = {
  periodId: string;
  periodName: string;
  /** ISO date string YYYY-MM-DD */
  startDate: string;
  /** ISO date string YYYY-MM-DD */
  endDate: string;
  scheduleId: string | null;
  assignments: AssignmentMap;
  guards: GuardSummary[];
  capacity: FullCapacityRules;
  /** Manager's court id — required for new assignments */
  courtId: string;
  /** When true: no clicks, no picker, view-only */
  readonly?: boolean;
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
      guards: GuardSummary[];
      capacity: FullCapacityRules;
      courtId: string;
    };

export type ShiftsPageData =
  | { found: false }
  | {
      found: true;
      periodId: string;
      periodName: string;
      startDate: string;
      endDate: string;
      scheduleId: string | null;
      assignments: AssignmentMap;
      guards: { id: string; name: string }[];
      capacity: FullCapacityRules;
      courtId: string;
    };
export type CourtShiftRuleRow = {
  id: string;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  position: import('@/generated/prisma/client').Position;
  requiredCount: number;
  displayOrder: number;
};
