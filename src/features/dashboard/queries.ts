import { periodScheduleStatus } from '@/features/schedules/period-status';
import { PortalRole } from '@/lib/auth/portal';
import { prisma } from '@/lib/db/client';
import type { PeriodSummary } from '@/features/periods/types';
import { getScheduleWarnings } from '@/features/schedules/assignments/queries';
import { parseISODateToUtcMidnight } from '@/features/periods/utils';
import type { ManagerDashboardData, ScheduleSnapshot } from './types';
import { requireSession } from '@/lib/db/auth-helpers';
import { currentScheduleWhere, preparationScheduleWhere } from '@/features/schedules/selection';
import { readFacilityCache } from '@/lib/cache/data-cache';

const staffedUser = { isActive: true, role: { rank: { not: 1 } } };

export type StaffPositionCount = {
  name: string;
  count: number;
  color: string | null;
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
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    startDate: Date;
    endDate: Date;
    submissionOpensAt: Date;
    submissionClosesAt: Date;
  },
  extras?: {
    submittedCount?: number;
    totalEmployees?: number;
    missingEmployees?: ManagerDashboardData['submissionSummary'] extends infer T ? T extends { missingEmployees: infer M } ? M : never : never;
  },
): ScheduleSnapshot {
  return {
    id: schedule.id,
    name: schedule.name,
    startDate: schedule.startDate.toISOString().slice(0, 10),
    endDate: schedule.endDate.toISOString().slice(0, 10),
    status: periodScheduleStatus(schedule),
    submissionDeadline: schedule.submissionClosesAt.toISOString(),
    ...extras,
  };
}

async function getSubmissionData(scheduleId: string, facilityId: string) {
  const [submittedSubmissions, totalEmployees, employees] = await Promise.all([
    prisma.availabilitySubmission.findMany({
      where: {
        scheduleId,
        submittedAt: { not: null },
        user: { facilityId, ...staffedUser },
      },
      select: { userId: true },
    }),
    prisma.user.count({ where: { facilityId, ...staffedUser } }),
    prisma.user.findMany({
      where: { facilityId, ...staffedUser },
      select: {
        id: true,
        displayName: true,
        role: { select: { name: true } },
      },
      orderBy: [{ displayName: 'asc' }],
    }),
  ]);

  const submittedIds = new Set(submittedSubmissions.map((s) => s.userId));
  const missingEmployees = employees
    .filter((employee) => !submittedIds.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      displayName: employee.displayName,
      positionName: employee.role.name,
    }));

  return {
    submittedCount: submittedIds.size,
    totalEmployees,
    missingEmployees,
  };
}

export async function getStaffCountsByPosition(facilityId: string): Promise<StaffPositionCount[]> {
  if (!facilityId) return [];

  const roles = await prisma.role.findMany({
    select: {
      name: true,
      rank: true,
      basePosition: { select: { color: true } },
      _count: { select: { users: { where: { facilityId, isActive: true } } } },
    },
    orderBy: { rank: 'asc' },
  });

  return roles.map((role) => ({
    name: role.name,
    count: role._count.users,
    color: role.basePosition?.color ?? null,
  }));
}

export async function getSchedulesForYear(facilityId: string, year: number): Promise<PeriodSummary[]> {
  if (!facilityId) return [];

  const { start, end } = yearDateRange(year);

  const [schedules, totalEmployees] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        facilityId,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      orderBy: { startDate: 'asc' },
      include: {
        _count: {
          select: {
            submissions: { where: { submittedAt: { not: null }, user: staffedUser } },
          },
        },
      },
    }),
    prisma.user.count({ where: { facilityId, ...staffedUser } }),
  ]);

  return schedules.map((schedule) => ({
    id: schedule.id,
    name: schedule.name,
    startDate: schedule.startDate.toISOString().slice(0, 10),
    endDate: schedule.endDate.toISOString().slice(0, 10),
    submissionDeadline: schedule.submissionClosesAt.toISOString(),
    status: periodScheduleStatus(schedule),
    submittedCount: schedule._count.submissions,
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

  return readFacilityCache(facilityId, ['dashboard', String(year)], async () => {
    const now = new Date();

    const [byPosition, totalActive, yearSchedules, activeRow, draftRow] = await Promise.all([
      getStaffCountsByPosition(facilityId),
      prisma.user.count({ where: { facilityId, isActive: true } }),
      getSchedulesForYear(facilityId, year),
      prisma.schedule.findFirst({
        where: currentScheduleWhere(facilityId, now),
        orderBy: { startDate: 'desc' },
      }),
      prisma.schedule.findFirst({
        where: preparationScheduleWhere(facilityId, now),
        orderBy: { startDate: 'desc' },
      }),
    ]);

    const activeSchedule = activeRow ? toScheduleSnapshot(activeRow) : null;

    let draftSchedule: ScheduleSnapshot | null = null;
    let submissionSummary: ManagerDashboardData['submissionSummary'] = null;

    if (draftRow) {
      const submission = await getSubmissionData(draftRow.id, facilityId);
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
  }, 30, true);
}
