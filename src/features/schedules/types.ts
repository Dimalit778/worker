import { PeriodScheduleStatus } from '@/features/schedules/period-status';
import type { DayCategory, ShiftType } from '@/generated/prisma/client';
import type { WarningSeverity, WarningType } from '@/features/scheduling-engine/types';

export type StaffingDayCategory = DayCategory | 'HOLIDAY';

export type ScheduleSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  status: PeriodScheduleStatus;
  submittedCount: number;
  totalEmployees: number;
};
export type ScheduleEmployeeOption = {
  id: string;
  displayName: string;
  position: {
    id: string;
    name: string;
    rank: number;
  } | null;
};

export type ScheduleCapacityRule = {
  id: string;
  positionId: string;
  displayName: string;
  rank: number;
  color: string | null;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  amount: number;
};

export type AssignmentSummary = {
  startsAt?: string;
  isLocked?: boolean;
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
  versionId?: string | null;
  revision?: number;
  fairness?: Array<{ employeeId: string; employeeName: string; totalShifts: number; nightShifts: number; weekendShifts: number; draftShifts: number }>;

  scheduleId: string;
  scheduleName: string;
  startDate: string;
  endDate: string;
  scheduleStatus: PeriodScheduleStatus | null;
  facilityId: string;
  employees: ScheduleEmployeeOption[];
  capacity: ScheduleCapacityRule[];
  assignments: AssignmentMap;
  warnings: ScheduleWarningSummary[];
  overflowCandidates: OverflowCandidateMap;
  hasUnpublishedDraft?: boolean;
  editingVersionNumber?: number | null;
  availabilitySubmissionSummary?: AvailabilitySubmissionSummary;
};

export type WeeklyDraftScheduleViewProps = {
  scheduleId: string;
  scheduleName: string;
  startDate: string;
  endDate: string;
  assignments: AssignmentMap;
  employees: ScheduleEmployeeOption[];
  capacity: ScheduleCapacityRule[];
  facilityId: string;
  overflowCandidates?: OverflowCandidateMap;
  readonly?: boolean;
  highlightedEmployeeId?: string | null;
};

export type WeekDay = {
  iso: string;
  dayOfWeek: number;
  letter: string;
  label: string;
};

export type AssignEmployeeToSlotParams = {
  scheduleId: string;
  facilityId?: string;
  employeeId: string;
  positionId: string;
  shiftType: ShiftType;
  date: string;
  slotIndex: number;
  /** Optional hours ("HH:mm") overriding the facility default for this assignment. */
  startTime?: string;
  endTime?: string;
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
