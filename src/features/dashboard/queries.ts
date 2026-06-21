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
    status: ScheduleStatus;
    period: {
      name: string;
      startDate: Date;
      endDate: Date;
      submissionDeadline?: Date;
    };
  },
  extras?: {
    submittedCount?: number;
    totalEmployees?: number;
    missingEmployees?: MissingEmployee[];
  },
): ScheduleSnapshot {
  return {
    id: schedule.id,
    name: schedule.period.name,
    startDate: schedule.period.startDate.toISOString().slice(0, 10),
    endDate: schedule.period.endDate.toISOString().slice(0, 10),
    status: schedule.status,
    submissionDeadline: schedule.period.submissionDeadline?.toISOString(),
    ...extras,
  };
}

async function getSubmissionData(periodId: string, courtId: string) {
  const [submittedSubmissions, totalEmployees, employees] = await Promise.all([
    prisma.availabilityForm.findMany({
      where: {
        periodId,
        isSubmitted: true,
        employee: { courtId, isActive: true, position: { code: { not: 1 } } },
      },
      select: { employeeId: true },
    }),
    prisma.employee.count({ where: { courtId, isActive: true, position: { code: { not: 1 } } } }),
    prisma.employee.findMany({
      where: { courtId, isActive: true, position: { code: { not: 1 } } },
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
    prisma.workSchedule.findMany({
      where: {
        courtId,
        period: {
          startDate: { lte: end },
          endDate: { gte: start },
        },
      },
      orderBy: { period: { startDate: 'asc' } },
      include: {
        period: {
          include: {
            _count: {
              select: {
                availabilityForms: { where: { isSubmitted: true, employee: { position: { code: { not: 1 } } } } },
              },
            },
          },
        },
      },
    }),
    prisma.employee.count({
      where: { courtId, isActive: true, position: { code: { not: 1 } } },
    }),
  ]);

  return schedules.map((schedule) => ({
    id: schedule.id,
    name: schedule.period.name,
    startDate: schedule.period.startDate.toISOString().slice(0, 10),
    endDate: schedule.period.endDate.toISOString().slice(0, 10),
    submissionDeadline: schedule.period.submissionDeadline.toISOString(),
    status: schedule.status,
    submittedCount: schedule.period._count.availabilityForms,
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
    prisma.workSchedule.findFirst({
      where: { courtId, status: ScheduleStatus.PUBLISHED, period: { endDate: { gte: today } } },
      include: { period: true },
      orderBy: { period: { startDate: 'desc' } },
    }),
    prisma.workSchedule.findFirst({
      where: {
        courtId,
        status: { in: [ScheduleStatus.DRAFT, ScheduleStatus.OPEN] },
      },
      include: { period: true },
      orderBy: { period: { startDate: 'desc' } },
    }),
  ]);

  const activeSchedule = activeRow ? toScheduleSnapshot(activeRow) : null;

  let draftSchedule: ScheduleSnapshot | null = null;
  let submissionSummary: ManagerDashboardData['submissionSummary'] = null;

  if (draftRow) {
    const submission = await getSubmissionData(draftRow.periodId, courtId);
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
