import { periodScheduleStatus, PeriodScheduleStatus } from '@/features/schedules/period-status';
import { loadSchedulingInput } from '../generation/queries';
import { computeFairnessSummary } from '@/features/scheduling-engine/fairness';
import { prisma } from '@/lib/db/client';
import {
  AssignmentMap,
  OverflowCandidateMap,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
  ScheduleWarningSummary,
  CurrentScheduleData,
} from '../types';
import {
  getDraftEditingVersionId,
  getDraftVersionMeta,
  getPublishedActiveVersionId,
} from '@/features/schedules/versions/queries';
import { buildAssignmentMap, getAssignmentCellKey, toScheduleData } from './utils';
import { todayUtcDateForTimeZone } from '@/features/periods/utils';
const SCHEDULE_TIME_ZONE = 'Asia/Jerusalem';

async function getScheduleCapacity(facilityId: string): Promise<ScheduleCapacityRule[]> {
  if (!facilityId) return [];

  const rows = await prisma.staffingRequirement.findMany({
    where: {
      facilityId,
      isActive: true,
      shiftRole: { code: { not: 1 } },
    },
    include: {
      shiftRole: { select: { id: true, name: true, code: true, color: true } },
    },
    orderBy: [
      { shiftType: 'asc' },
      { shiftRole: { code: 'asc' } },
      { shiftRole: { id: 'asc' } },
      { dayCategory: 'asc' },
      { id: 'asc' },
    ],
  });

  return rows.map((r) => ({
    id: r.id,
    positionId: r.shiftRoleId,
    displayName: r.shiftRole.name,
    code: r.shiftRole.code,
    color: r.shiftRole.color,
    shiftType: r.shiftType,
    dayCategory: r.dayCategory,
    amount: r.requiredCount,
  }));
}

async function getScheduleEmployees(facilityId: string): Promise<ScheduleEmployeeOption[]> {
  if (!facilityId) return [];

  const employees = await prisma.employee.findMany({
    where: { facilityId, isActive: true, primaryShiftRole: { code: { not: 1 } } },
    select: {
      id: true,
      displayName: true,
      primaryShiftRole: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ primaryShiftRole: { code: 'asc' } }],
  });

  return employees.map((e) => ({
    id: e.id,
    displayName: e.displayName,
    position: {
      id: e.primaryShiftRole.id,
      name: e.primaryShiftRole.name,
      code: e.primaryShiftRole.code,
    },
  }));
}

async function getAssignmentMap(
  scheduleId: string | null | undefined,
  versionId: string | null,
): Promise<AssignmentMap> {
  if (!scheduleId || !versionId) return {};

  const rows = await prisma.shiftAssignment.findMany({
    where: { scheduleId, versionId },
    include: {
      employee: { select: { displayName: true } },
      shiftRole: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { shiftRole: { code: 'asc' } }, { id: 'asc' }],
  });

  const cellOrder = new Map<string, number>();
  return buildAssignmentMap(
    rows.map((a) => {
      const cellKey = getAssignmentCellKey({
        date: a.date,
        shiftType: a.shiftType,
        positionId: a.shiftRoleId,
      });
      const slotIndex = cellOrder.get(cellKey) ?? 0;
      cellOrder.set(cellKey, slotIndex + 1);
      return {
        id: a.id,
        isLocked: a.isLocked,
        date: a.date,
        shiftType: a.shiftType,
        positionId: a.shiftRoleId,
        positionName: a.shiftRole.name,
        employeeId: a.employeeId,
        employeeDisplayName: a.employee.displayName,
        slotIndex,
      };
    }),
  );
}

type PublishedScheduleRow = {
  id: string;
  periodId: string;
  status: PeriodScheduleStatus;
  period: {
    name: string;
    startDate: Date;
    endDate: Date;
  };
};

async function buildPublishedScheduleData(
  scheduleRow: PublishedScheduleRow | null,
  facilityId: string,
): Promise<CurrentScheduleData | null> {
  if (!scheduleRow) return null;

  const publishedVersionId = await getPublishedActiveVersionId(scheduleRow.id);

  const [assignments, capacity, employees] = await Promise.all([
    getAssignmentMap(scheduleRow.id, publishedVersionId),
    getScheduleCapacity(facilityId),
    getScheduleEmployees(facilityId),
  ]);

  const meta = await prisma.rosterVersion.findUnique({ where: { id: publishedVersionId ?? '' }, select: { revision: true } });
  const base = toScheduleData(scheduleRow, facilityId, employees, capacity, assignments, [], {});
  return base ? { ...base, versionId: publishedVersionId, revision: meta?.revision ?? 0 } : null;
}

export async function getCurrentSchedule(facilityId: string): Promise<CurrentScheduleData | null> {
  const today = todayUtcDateForTimeZone(SCHEDULE_TIME_ZONE);

  const scheduleRow = await prisma.roster.findFirst({
    where: {
      archivedAt: null,
      versions: { some: { status: 'PUBLISHED', isActive: true } },
      facilityId,
      period: {
        startDate: { lte: today },
        endDate: { gte: today },
      },
    },
    select: {
      id: true,
      periodId: true,
      period: {
        select: {
          name: true,
          startDate: true,
          endDate: true,
        },
      },
    },
    orderBy: { period: { startDate: 'desc' } },
  });

  return buildPublishedScheduleData(
    scheduleRow ? { ...scheduleRow, status: PeriodScheduleStatus.PUBLISHED } : null,
    facilityId,
  );
}

export async function getUpcomingSchedule(facilityId: string): Promise<CurrentScheduleData | null> {
  const today = todayUtcDateForTimeZone(SCHEDULE_TIME_ZONE);

  const scheduleRow = await prisma.roster.findFirst({
    where: {
      archivedAt: null,
      versions: { some: { status: 'PUBLISHED', isActive: true } },
      facilityId,
      period: {
        startDate: { gt: today },
      },
    },
    select: {
      id: true,
      periodId: true,
      period: {
        select: {
          name: true,
          startDate: true,
          endDate: true,
        },
      },
    },
    orderBy: { period: { startDate: 'asc' } },
  });

  return buildPublishedScheduleData(
    scheduleRow ? { ...scheduleRow, status: PeriodScheduleStatus.PUBLISHED } : null,
    facilityId,
  );
}

export async function getDraftScheduleData(facilityId: string, scheduleId?: string): Promise<CurrentScheduleData | null> {
  const schedule = await prisma.roster.findFirst({
    where: {
      facilityId,
      ...(scheduleId ? { id: scheduleId } : { archivedAt: null, OR: [{ versions: { some: { status: 'DRAFT' } } }, { versions: { none: { status: 'PUBLISHED', isActive: true } } }] }),
    },
    select: {
      id: true,
      periodId: true,
      archivedAt: true,
      versions: { select: { status: true, isActive: true } },
      period: {
        select: {
          name: true,
          startDate: true,
          endDate: true,
          submissionState: true,
        },
      },
    },
    orderBy: { period: { startDate: 'desc' } },
  });
  if (!schedule) return null;

  const [editingVersionId, versionMeta, employees, capacity, warnings, overflowCandidates, submittedSubmissions] =
    await Promise.all([
      getDraftEditingVersionId(schedule.id),
      getDraftVersionMeta(schedule.id),
      getScheduleEmployees(facilityId),
      getScheduleCapacity(facilityId),
      getScheduleWarnings(schedule.id),
      Promise.resolve({} as OverflowCandidateMap),
      prisma.availabilitySubmission.findMany({
        where: {
          periodId: schedule.periodId,
          isSubmitted: true,
          employee: { facilityId, isActive: true, primaryShiftRole: { code: { not: 1 } } },
        },
        select: { employeeId: true },
      }),
    ]);

  const assignments = await getAssignmentMap(schedule.id, editingVersionId);
  const analysisInput = await loadSchedulingInput(prisma, schedule.id, facilityId, editingVersionId);
  const combined = computeFairnessSummary([...(analysisInput.input.historicalAssignments ?? []), ...analysisInput.allAssignments]);
  const draftCounts = computeFairnessSummary(analysisInput.allAssignments);
  const fairness = employees.map(employee => ({
    employeeId: employee.id, employeeName: employee.displayName,
    totalShifts: combined.get(employee.id)?.totalShifts ?? 0,
    nightShifts: combined.get(employee.id)?.nightShifts ?? 0,
    weekendShifts: combined.get(employee.id)?.weekendShifts ?? 0,
    draftShifts: draftCounts.get(employee.id)?.totalShifts ?? 0,
  }));
  const submittedEmployeeIds = new Set(submittedSubmissions.map((submission) => submission.employeeId));
  const missingEmployees = employees
    .filter((employee) => !submittedEmployeeIds.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      displayName: employee.displayName,
      positionName: employee.position?.name ?? null,
    }));

  const base = toScheduleData(
    {
      ...schedule,
      status: periodScheduleStatus({
        archivedAt: schedule.archivedAt,
        submissionState: schedule.period.submissionState,
        versions: schedule.versions,
      }),
    },
    facilityId,
    employees,
    capacity,
    assignments,
    warnings,
    overflowCandidates,
  );
  if (!base) {
    return null;
  }

  return {
    ...base, fairness,
    versionId: versionMeta.versionId,
    revision: versionMeta.revision,
    hasUnpublishedDraft: versionMeta.hasUnpublishedDraft,
    editingVersionNumber: versionMeta.editingVersionNumber,
    availabilitySubmissionSummary: {
      submittedCount: submittedEmployeeIds.size,
      eligibleEmployeeCount: employees.length,
      missingEmployees,
    },
  };
}

export async function getScheduleWarnings(scheduleId: string | null | undefined): Promise<ScheduleWarningSummary[]> {
  if (!scheduleId) return [];

  const versionId = await getDraftEditingVersionId(scheduleId);
  if (!versionId) return [];
  const rows = await prisma.scheduleWarning.findMany({
    where: {
      scheduleId, versionId,
      OR: [{ employeeId: null }, { employee: { primaryShiftRole: { code: { not: 1 } } } }],
    },
    select: {
      id: true,
      type: true,
      severity: true,
      message: true,
      date: true,
      shiftType: true,
      employee: { select: { displayName: true } },
      shiftRole: { select: { name: true } },
    },
    orderBy: [{ severity: 'asc' }, { date: 'asc' }, { shiftType: 'asc' }, { id: 'asc' }],
  });

  return rows.map((warning) => ({
    id: warning.id,
    type: warning.type,
    severity: warning.severity,
    message: warning.message,
    date: warning.date?.toISOString().slice(0, 10) ?? null,
    shiftType: warning.shiftType,
    employeeName: warning.employee?.displayName ?? null,
    positionName: warning.shiftRole?.name ?? null,
  }));
}
