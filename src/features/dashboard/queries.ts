import { prisma } from '@/lib/db/client';
import { ScheduleStatus, SystemRole } from '@/generated/prisma/client';
import type { PeriodSummary } from '@/features/periods/types';
import { getScheduleWarnings } from '@/features/schedules/assignments/queries';
import { parseISODateToUtcMidnight, todayUtcDateForTimeZone } from '@/features/periods/utils';
import type { ManagerDashboardData, MissingEmployee, ScheduleSnapshot } from './types';
import { requireSession } from '@/lib/db/auth-helpers';

const SCHEDULE_TIME_ZONE = 'Asia/Jerusalem';

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

export async function getStaffCountsByPosition(courtId: string): Promise<StaffPositionCount[]> {
  if (!courtId) return [];

  const positions = await prisma.position.findMany({
    where: {
      courtId,
      isActive: true,
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

  return positions.map((p) => ({
    name: p.name,
    count: p._count.employees,
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

export async function getManagerDashboardData(year: number): Promise<ManagerDashboardData> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;

  const empty: ManagerDashboardData = {
    staff: { byPosition: [], totalActive: 0 },
    activeSchedule: null,
    draftSchedule: null,
    warnings: [],
    submissionSummary: null,
    yearSchedules: [],
  };

  if (!courtId) return empty;

  const today = todayUtcDateForTimeZone(SCHEDULE_TIME_ZONE);

  const [byPosition, totalActive, yearSchedules, activeRow, draftRow] = await Promise.all([
    getStaffCountsByPosition(courtId),
    prisma.employee.count({ where: { courtId, isActive: true } }),
    getSchedulesForYear(courtId, year),
    prisma.schedule.findFirst({
      where: { courtId, status: ScheduleStatus.ACTIVE, endDate: { gte: today } },
      orderBy: { startDate: 'desc' },
    }),
    prisma.schedule.findFirst({
      where: {
        courtId,
        status: { in: [ScheduleStatus.DRAFT, ScheduleStatus.OPEN_FOR_SUBMISSION] },
      },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  const activeSchedule = activeRow ? toScheduleSnapshot(activeRow) : null;

  let draftSchedule: ScheduleSnapshot | null = null;
  let submissionSummary: ManagerDashboardData['submissionSummary'] = null;

  if (draftRow) {
    const submission = await getSubmissionData(draftRow.id, courtId);
    draftSchedule = toScheduleSnapshot(draftRow, submission);
    submissionSummary = {
      submittedCount: submission.submittedCount,
      eligibleCount: submission.totalEmployees,
      missingEmployees: submission.missingEmployees,
    };
  }

  const warnings = draftRow ? await getScheduleWarnings(draftRow.id) : [];

  return {
    staff: { byPosition, totalActive },
    activeSchedule,
    draftSchedule,
    warnings,
    submissionSummary,
    yearSchedules,
  };
}
