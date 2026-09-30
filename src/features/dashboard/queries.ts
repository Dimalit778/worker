import { periodScheduleStatus, PeriodScheduleStatus } from '@/features/schedules/period-status';
import { PortalRole } from '@/lib/auth/portal';
import { prisma } from '@/lib/db/client';
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
    archivedAt: Date | null;
    versions: { status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; isActive: boolean }[];
    period: {
      name: string;
      submissionState: 'SCHEDULED' | 'OPEN' | 'CLOSED';
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
    status: periodScheduleStatus({
      archivedAt: schedule.archivedAt,
      submissionState: schedule.period.submissionState,
      versions: schedule.versions,
    }),
    submissionDeadline: schedule.period.submissionDeadline?.toISOString(),
    ...extras,
  };
}

async function getSubmissionData(periodId: string, facilityId: string) {
  const [submittedSubmissions, totalEmployees, employees] = await Promise.all([
    prisma.availabilitySubmission.findMany({
      where: {
        periodId,
        isSubmitted: true,
        employee: { facilityId, isActive: true, primaryShiftRole: { code: { not: 1 } } },
      },
      select: { employeeId: true },
    }),
    prisma.employee.count({ where: { facilityId, isActive: true, primaryShiftRole: { code: { not: 1 } } } }),
    prisma.employee.findMany({
      where: { facilityId, isActive: true, primaryShiftRole: { code: { not: 1 } } },
      select: {
        id: true,
        displayName: true,
        primaryShiftRole: { select: { name: true } },
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
      positionName: employee.primaryShiftRole.name,
    }));

  return {
    submittedCount: submittedIds.size,
    totalEmployees,
    missingEmployees,
  };
}

export async function getStaffCountsByPosition(facilityId: string): Promise<StaffPositionCount[]> {
  if (!facilityId) return [];

  const positions = await prisma.shiftRole.findMany({
    where: {
      facilityId,
      isActive: true,
    },
    select: {
      name: true,
      code: true,
      _count: {
        select: {
          primaryEmployees: { where: { isActive: true } },
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  return positions.map((p) => ({
    name: p.name,
    count: p._count.primaryEmployees,
  }));
}

export async function getSchedulesForYear(facilityId: string, year: number): Promise<PeriodSummary[]> {
  if (!facilityId) return [];

  const { start, end } = yearDateRange(year);

  const [schedules, totalEmployees] = await Promise.all([
    prisma.roster.findMany({
      where: {
        facilityId,
        period: {
          startDate: { lte: end },
          endDate: { gte: start },
        },
      },
      orderBy: { period: { startDate: 'asc' } },
      include: {
        versions: { select: { status: true, isActive: true } },
        period: {
          include: {
            _count: {
              select: {
                availabilitySubmissions: { where: { isSubmitted: true, employee: { primaryShiftRole: { code: { not: 1 } } } } },
              },
            },
          },
        },
      },
    }),
    prisma.employee.count({
      where: { facilityId, isActive: true, primaryShiftRole: { code: { not: 1 } } },
    }),
  ]);

  return schedules.map((schedule) => ({
    id: schedule.id,
    name: schedule.period.name,
    startDate: schedule.period.startDate.toISOString().slice(0, 10),
    endDate: schedule.period.endDate.toISOString().slice(0, 10),
    submissionDeadline: schedule.period.submissionDeadline.toISOString(),
    status: periodScheduleStatus({
      archivedAt: schedule.archivedAt,
      submissionState: schedule.period.submissionState,
      versions: schedule.versions,
    }),
    submittedCount: schedule.period._count.availabilitySubmissions,
    totalEmployees,
  }));
}

export async function getManagerDashboardData(year: number): Promise<ManagerDashboardData> {
  const session = await requireSession(PortalRole.MANAGER);
  const facilityId = session.user.facilityId;

  const empty: ManagerDashboardData = {
    staff: { byPosition: [], totalActive: 0 },
    activeSchedule: null,
    draftSchedule: null,
    warnings: [],
    submissionSummary: null,
    yearSchedules: [],
  };

  if (!facilityId) return empty;

  const today = todayUtcDateForTimeZone(SCHEDULE_TIME_ZONE);

  const [byPosition, totalActive, yearSchedules, activeRow, draftRow] = await Promise.all([
    getStaffCountsByPosition(facilityId),
    prisma.employee.count({ where: { facilityId, isActive: true } }),
    getSchedulesForYear(facilityId, year),
    prisma.roster.findFirst({
      where: {
        facilityId,
        archivedAt: null,
        versions: { some: { status: 'PUBLISHED', isActive: true } },
        period: { endDate: { gte: today } },
      },
      include: { period: true, versions: { select: { status: true, isActive: true } } },
      orderBy: { period: { startDate: 'desc' } },
    }),
    prisma.roster.findFirst({
      where: {
        facilityId,
        archivedAt: null,
        versions: { none: { status: 'PUBLISHED', isActive: true } },
        period: { submissionState: { in: ['SCHEDULED', 'OPEN'] } },
      },
      include: { period: true, versions: { select: { status: true, isActive: true } } },
      orderBy: { period: { startDate: 'desc' } },
    }),
  ]);

  const activeSchedule = activeRow ? toScheduleSnapshot(activeRow) : null;

  let draftSchedule: ScheduleSnapshot | null = null;
  let submissionSummary: ManagerDashboardData['submissionSummary'] = null;

  if (draftRow) {
    const submission = await getSubmissionData(draftRow.periodId, facilityId);
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
