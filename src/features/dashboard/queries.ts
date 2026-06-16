import { prisma } from '@/lib/db/client';
import { ScheduleStatus, WarningType } from '@/generated/prisma/client';
import type { PeriodSummary } from '@/features/periods/types';
import { shiftStaffingPositionsWhere } from '@/features/settings/queries';
import { getScheduleWarnings } from '@/features/schedules/assignments/queries';
import { addDays, calendarDateISO, parseISODateToUtcMidnight, todayUtcDateForTimeZone } from '@/features/periods/utils';
import type { ManagerDashboardData, MissingEmployee, ScheduleSnapshot, StaffingGap } from './types';

const SCHEDULE_TIME_ZONE = 'Asia/Jerusalem';
const STAFF_POSITION_NAMES = ['אחמ״ש', 'בקר', 'מאבטח'] as const;

export type StaffPositionCount = {
  name: string;
  count: number;
};

function yearDateRange(year: number) {
  return {
    start: parseISODateToUtcMidnight(`${year}-01-01`),
    end: parseISODateToUtcMidnight(`${year}-12-31`),
  };
}

function toScheduleSnapshot(
  schedule: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    status: ScheduleStatus;
    submissionDeadline?: Date;
  },
  extras?: {
    submittedCount?: number;
    totalEmployees?: number;
    missingEmployees?: MissingEmployee[];
  },
): ScheduleSnapshot {
  return {
    id: schedule.id,
    name: schedule.name,
    startDate: schedule.startDate.toISOString().slice(0, 10),
    endDate: schedule.endDate.toISOString().slice(0, 10),
    status: schedule.status,
    submissionDeadline: schedule.submissionDeadline?.toISOString(),
    ...extras,
  };
}

function currentWeekRange() {
  const today = calendarDateISO(new Date(), SCHEDULE_TIME_ZONE);
  const dayOfWeek = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStart = addDays(today, -dayOfWeek);
  const weekEnd = addDays(weekStart, 6);
  return { weekStart, weekEnd };
}

async function getSubmissionData(scheduleId: string, courtId: string) {
  const [submittedSubmissions, totalEmployees, employees] = await Promise.all([
    prisma.availabilitySubmission.findMany({
      where: {
        scheduleId,
        isSubmitted: true,
        employee: { courtId, isActive: true },
      },
      select: { employeeId: true },
    }),
    prisma.employee.count({ where: { courtId, isActive: true } }),
    prisma.employee.findMany({
      where: { courtId, isActive: true },
      select: {
        id: true,
        displayName: true,
        position: { select: { name: true } },
      },
      orderBy: [{ displayName: 'asc' }],
    }),
  ]);

  const submittedIds = new Set(submittedSubmissions.map((s) => s.employeeId));
  const missingEmployees = employees
    .filter((employee) => !submittedIds.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      displayName: employee.displayName,
      positionName: employee.position.name,
    }));

  return {
    submittedCount: submittedIds.size,
    totalEmployees,
    missingEmployees,
  };
}

async function getStaffingGaps(courtId: string): Promise<StaffingGap[]> {
  const positions = await prisma.position.findMany({
    where: shiftStaffingPositionsWhere(courtId),
    select: {
      name: true,
      _count: { select: { employees: { where: { isActive: true } } } },
      staffingRequirements: {
        where: { isActive: true },
        select: { requiredCount: true },
      },
    },
    orderBy: { code: 'asc' },
  });

  return positions.map((position) => {
    const requiredPerShift = position.staffingRequirements.reduce(
      (max, requirement) => Math.max(max, requirement.requiredCount),
      0,
    );
    const employeeCount = position._count.employees;

    return {
      positionName: position.name,
      employeeCount,
      requiredPerShift,
      gap: employeeCount - requiredPerShift,
    };
  });
}

async function getWeekCoverage(activeScheduleId: string | null, courtId: string) {
  const { weekStart, weekEnd } = currentWeekRange();

  if (!activeScheduleId) {
    return {
      weekStart,
      weekEnd,
      filledSlots: 0,
      unfilledSlots: 0,
      hasActiveSchedule: false,
    };
  }

  const weekStartDate = parseISODateToUtcMidnight(weekStart);
  const weekEndDate = parseISODateToUtcMidnight(weekEnd);

  const [filledSlots, unfilledSlots] = await Promise.all([
    prisma.shiftAssignment.count({
      where: {
        scheduleId: activeScheduleId,
        courtId,
        date: { gte: weekStartDate, lte: weekEndDate },
      },
    }),
    prisma.scheduleWarning.count({
      where: {
        scheduleId: activeScheduleId,
        courtId,
        type: { in: [WarningType.UNFILLED, WarningType.UNDERSTAFFED] },
        date: { gte: weekStartDate, lte: weekEndDate },
      },
    }),
  ]);

  return {
    weekStart,
    weekEnd,
    filledSlots,
    unfilledSlots,
    hasActiveSchedule: true,
  };
}

async function getFairnessHighlights(activeScheduleId: string | null) {
  if (!activeScheduleId) return [];

  const records = await prisma.fairnessRecord.findMany({
    where: { scheduleId: activeScheduleId },
    include: {
      employee: { select: { displayName: true } },
    },
    orderBy: [{ weekendShifts: 'desc' }, { totalShifts: 'desc' }],
    take: 5,
  });

  return records.map((record) => ({
    employeeName: record.employee.displayName,
    weekendShifts: record.weekendShifts,
    totalShifts: record.totalShifts,
  }));
}

async function getRecentActivity(courtId: string) {
  const logs = await prisma.scheduleChangeLog.findMany({
    where: { schedule: { courtId } },
    include: {
      schedule: { select: { name: true } },
      changedBy: {
        select: {
          email: true,
          employee: { select: { displayName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return logs.map((log) => ({
    id: log.id,
    scheduleName: log.schedule.name,
    changeType: log.changeType,
    message: log.message,
    changedByName: log.changedBy.employee?.displayName ?? log.changedBy.email,
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function getStaffCountsByPosition(courtId: string): Promise<StaffPositionCount[]> {
  if (!courtId) return STAFF_POSITION_NAMES.map((name) => ({ name, count: 0 }));

  const positions = await prisma.position.findMany({
    where: {
      courtId,
      isActive: true,
      name: { in: [...STAFF_POSITION_NAMES] },
    },
    select: {
      name: true,
      code: true,
      _count: {
        select: {
          employees: { where: { isActive: true } },
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  const byName = new Map(positions.map((p) => [p.name, p._count.employees]));

  return STAFF_POSITION_NAMES.map((name) => ({
    name,
    count: byName.get(name) ?? 0,
  }));
}

export async function getSchedulesForYear(courtId: string, year: number): Promise<PeriodSummary[]> {
  if (!courtId) return [];

  const { start, end } = yearDateRange(year);

  const [schedules, totalEmployees] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        courtId,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      orderBy: { startDate: 'asc' },
      include: {
        _count: {
          select: {
            availabilitySubmissions: { where: { isSubmitted: true } },
          },
        },
      },
    }),
    prisma.employee.count({
      where: { courtId, isActive: true },
    }),
  ]);

  return schedules.map((schedule) => ({
    id: schedule.id,
    name: schedule.name,
    startDate: schedule.startDate.toISOString().slice(0, 10),
    endDate: schedule.endDate.toISOString().slice(0, 10),
    submissionDeadline: schedule.submissionDeadline.toISOString(),
    status: schedule.status,
    submittedCount: schedule._count.availabilitySubmissions,
    totalEmployees,
  }));
}

export async function getManagerDashboardData(courtId: string, year: number): Promise<ManagerDashboardData> {
  const empty: ManagerDashboardData = {
    staff: { byPosition: STAFF_POSITION_NAMES.map((name) => ({ name, count: 0 })), totalActive: 0, gaps: [] },
    activeSchedule: null,
    draftSchedule: null,
    workingSchedule: null,
    nextSchedule: null,
    warnings: [],
    submissionSummary: null,
    weekCoverage: {
      weekStart: currentWeekRange().weekStart,
      weekEnd: currentWeekRange().weekEnd,
      filledSlots: 0,
      unfilledSlots: 0,
      hasActiveSchedule: false,
    },
    fairness: [],
    recentActivity: [],
    yearSchedules: [],
  };

  if (!courtId) return empty;

  const today = todayUtcDateForTimeZone(SCHEDULE_TIME_ZONE);

  const [byPosition, totalActive, gaps, yearSchedules, activeRow, openRow, workingRow, nextRow, recentActivity] =
    await Promise.all([
      getStaffCountsByPosition(courtId),
      prisma.employee.count({ where: { courtId, isActive: true } }),
      getStaffingGaps(courtId),
      getSchedulesForYear(courtId, year),
      prisma.schedule.findFirst({
        where: { courtId, status: ScheduleStatus.ACTIVE, endDate: { gte: today } },
        orderBy: { startDate: 'desc' },
      }),
      prisma.schedule.findFirst({
        where: { courtId, status: ScheduleStatus.OPEN_FOR_SUBMISSION },
        orderBy: { startDate: 'desc' },
      }),
      prisma.schedule.findFirst({
        where: { courtId, status: { not: ScheduleStatus.ARCHIVED } },
        orderBy: { startDate: 'desc' },
      }),
      prisma.schedule.findFirst({
        where: { courtId, startDate: { gt: today }, status: { not: ScheduleStatus.ARCHIVED } },
        orderBy: { startDate: 'asc' },
      }),
      getRecentActivity(courtId),
    ]);

  const activeSchedule = activeRow ? toScheduleSnapshot(activeRow) : null;

  let openScheduleFinal: ScheduleSnapshot | null = null;
  if (openRow) {
    const submission = await getSubmissionData(openRow.id, courtId);
    openScheduleFinal = toScheduleSnapshot(openRow, submission);
  }

  const workingSchedule = workingRow ? toScheduleSnapshot(workingRow) : null;
  const nextSchedule = nextRow ? toScheduleSnapshot(nextRow) : null;

  const warningsScheduleId = workingRow?.id ?? openRow?.id ?? activeRow?.id ?? null;
  const [warnings, weekCoverage, fairness] = await Promise.all([
    getScheduleWarnings(warningsScheduleId),
    getWeekCoverage(activeRow?.id ?? null, courtId),
    getFairnessHighlights(activeRow?.id ?? null),
  ]);

  const submissionSource = openRow ?? workingRow;
  const submissionSummary = submissionSource
    ? await getSubmissionData(submissionSource.id, courtId).then((data) => ({
        submittedCount: data.submittedCount,
        eligibleCount: data.totalEmployees,
        missingEmployees: data.missingEmployees,
      }))
    : null;

  return {
    staff: { byPosition, totalActive, gaps },
    activeSchedule,
    draftSchedule: openScheduleFinal,
    workingSchedule,
    nextSchedule,
    warnings,
    submissionSummary,
    weekCoverage,
    fairness,
    recentActivity,
    yearSchedules,
  };
}
