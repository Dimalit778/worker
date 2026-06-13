import type { DayCategory, ScheduleStatus, ShiftType, WarningSeverity, WarningType } from '@/generated/prisma/client';

export type ScheduleEmployeeOption = {
  id: string;
  displayName: string;
  position: {
    id: string;
    name: string;
    code: number;
  } | null;
};

export type ScheduleCapacityRule = {
  id: string;
  positionId: string;
  displayName: string;
  code: number;
  color: string | null;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  amount: number;
};

export type AssignmentSummary = {
  id: string;
  employeeId: string;
  employeeDisplayName: string;
  positionId: string;
  positionName: string;
  shiftType: ShiftType;
  slotIndex: number;
};

/** Example: `2026-04-26-MORNING-<positionId>` */
export type AssignmentCellKey = `${string}-${ShiftType}-${string}`;

export type AssignmentMap = Record<AssignmentCellKey, AssignmentSummary[]>;

export type OverflowCandidateSummary = {
  employeeId: string;
  employeeName: string;
};

export type OverflowCandidateCellKey = `${AssignmentCellKey}-${number}`;

export type OverflowCandidateMap = Record<OverflowCandidateCellKey, OverflowCandidateSummary[]>;

export type ScheduleWarningSummary = {
  id: string;
  type: WarningType;
  severity: WarningSeverity;
  message: string;
  date: string | null;
  shiftType: ShiftType | null;
  employeeName: string | null;
  positionName: string | null;
};

/** Submitted availability vs active employees for a period (manager-facing). */
export type AvailabilitySubmissionSummary = {
  submittedCount: number;
  eligibleEmployeeCount: number;
  missingEmployees: Array<{
    id: string;
    displayName: string;
    positionName: string | null;
  }>;
};

export type CurrentScheduleData = {
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
  warnings: ScheduleWarningSummary[];
  overflowCandidates: OverflowCandidateMap;
  availabilitySubmissionSummary?: AvailabilitySubmissionSummary;
};

/** Props for the week / shift schedule UI */
export type ScheduleViewProps = {
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
  overflowCandidates?: OverflowCandidateMap;
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
// Schedule mode: current or future
export type ScheduleMode = 'current' | 'future';

export type ScheduleViewerRole = 'manager' | 'employee';

export type ScheduleAccess = {
  canEdit: boolean;
  canGenerate: boolean;
  canPublish: boolean;
  canViewWarnings: boolean;
  canViewSubmissions: boolean;
};
