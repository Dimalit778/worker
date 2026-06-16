import type { ScheduleChangeType, ScheduleStatus } from '@/generated/prisma/client';
import type { PeriodSummary } from '@/features/periods/types';
import type { ScheduleWarningSummary } from '@/features/schedules/types';
import type { StaffPositionCount } from './queries';

export type StaffingGap = {
  positionName: string;
  employeeCount: number;
  requiredPerShift: number;
  gap: number;
};

export type MissingEmployee = {
  id: string;
  displayName: string;
  positionName: string | null;
};

export type ScheduleSnapshot = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: ScheduleStatus;
  submissionDeadline?: string;
  submittedCount?: number;
  totalEmployees?: number;
  missingEmployees?: MissingEmployee[];
};

export type WeekCoverage = {
  weekStart: string;
  weekEnd: string;
  filledSlots: number;
  unfilledSlots: number;
  hasActiveSchedule: boolean;
};

export type FairnessHighlight = {
  employeeName: string;
  weekendShifts: number;
  totalShifts: number;
};

export type RecentActivityItem = {
  id: string;
  scheduleName: string;
  changeType: ScheduleChangeType;
  message: string | null;
  changedByName: string;
  createdAt: string;
};

export type ManagerDashboardData = {
  staff: {
    byPosition: StaffPositionCount[];
    totalActive: number;
    gaps: StaffingGap[];
  };
  activeSchedule: ScheduleSnapshot | null;
  draftSchedule: ScheduleSnapshot | null;
  workingSchedule: ScheduleSnapshot | null;
  nextSchedule: ScheduleSnapshot | null;
  warnings: ScheduleWarningSummary[];
  submissionSummary: {
    submittedCount: number;
    eligibleCount: number;
    missingEmployees: MissingEmployee[];
  } | null;
  weekCoverage: WeekCoverage;
  fairness: FairnessHighlight[];
  recentActivity: RecentActivityItem[];
  yearSchedules: PeriodSummary[];
};
