import { periodScheduleStatus, PeriodScheduleStatus } from '@/features/schedules/period-status';
import { loadSchedulingInput } from '../generation/queries';
import { loadedScheduleDetails } from './loaded-details';
import { analyzeSchedule } from '../generation/recalculate';
import { toWarningSummaries } from '../warnings/summaries';
import { prisma } from '@/lib/db/client';
import {
  AssignmentMap,
  OverflowCandidateMap,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
  ScheduleWarningSummary,
  CurrentScheduleData,
} from '../types';
import type { Schedule, ScheduleVersion } from '@/generated/prisma/client';
import { buildAssignmentMap, toScheduleData } from './utils';
import { todayUtcDateForTimeZone } from '@/features/periods/utils';

const SCHEDULE_TIME_ZONE = 'Asia/Jerusalem';
const staffedUser = { isActive: true, role: { rank: { not: 1 } } };
const staffedPosition = {
  isActive: true,
  NOT: { OR: [{ requiredRank: 1 }, { baseRole: { rank: 1 } }] },
};

function rankOf(position: { requiredRank: number | null; displayOrder: number; baseRole: { rank: number } | null }) {
  return position.requiredRank ?? position.baseRole?.rank ?? position.displayOrder;
}

async function getScheduleCapacity(facilityId: string): Promise<ScheduleCapacityRule[]> {
  if (!facilityId) return [];

  const rows = await prisma.staffingRequirement.findMany({
    where: { facilityId, position: staffedPosition },
    include: {
      position: { select: { id: true, name: true, color: true, requiredRank: true, displayOrder: true, baseRole: { select: { rank: true } } } },
    },
    orderBy: [
      { shiftType: 'asc' },
      { position: { displayOrder: 'asc' } },
      { position: { id: 'asc' } },
      { dayCategory: 'asc' },
      { id: 'asc' },
    ],
  });

  return rows.map((r) => ({
    id: r.id,
    positionId: r.positionId,
    displayName: r.position.name,
    rank: rankOf(r.position),
    color: r.position.color,
    shiftType: r.shiftType,
    dayCategory: r.dayCategory,
    amount: r.requiredCount,
  }));
}

async function getScheduleEmployees(facilityId: string): Promise<ScheduleEmployeeOption[]> {
  if (!facilityId) return [];

  const employees = await prisma.user.findMany({
    where: { facilityId, ...staffedUser },
    select: {
      id: true,
      displayName: true,
      role: { select: { id: true, name: true, rank: true } },
    },
    orderBy: [{ role: { rank: 'asc' } }],
  });

  return employees.map((e) => ({
    id: e.id,
    displayName: e.displayName,
    position: {
      id: e.role.id,
      name: e.role.name,
      rank: e.role.rank,
    },
  }));
}

async function getAssignmentMap(versionId: string | null | undefined): Promise<AssignmentMap> {
  if (!versionId) return {};

  const rows = await prisma.scheduleSlot.findMany({
    where: { versionId, userId: { not: null } },
    include: {
      user: { select: { displayName: true } },
      position: { select: { id: true, name: true } },
    },
    orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { slotNumber: 'asc' }],
  });

  return buildAssignmentMap(
    rows.flatMap((a) => {
      if (!a.userId || !a.user) return [];
      return [{
        id: a.id,
        isLocked: a.isLocked,
        date: a.date,
        shiftType: a.shiftType,
        positionId: a.positionId,
        positionName: a.position.name,
        employeeId: a.userId,
        employeeDisplayName: a.user.displayName,
        slotIndex: a.slotNumber - 1,
      }];
    }),
  );
}

type ScheduleRow = Schedule & { publishedVersion: ScheduleVersion | null };

function toPeriodRow(schedule: { id: string; name: string; startDate: Date; endDate: Date; status: PeriodScheduleStatus }) {
  return {
    id: schedule.id,
    status: schedule.status,
    period: { name: schedule.name, startDate: schedule.startDate, endDate: schedule.endDate },
  };
}

async function buildPublishedScheduleData(
  scheduleRow: ScheduleRow | null,
  facilityId: string,
): Promise<CurrentScheduleData | null> {
  if (!scheduleRow) return null;

  const publishedVersionId = scheduleRow.publishedVersionId;
  if (!publishedVersionId) return null;
  const [assignments, capacity, employees] = await Promise.all([
    getAssignmentMap(publishedVersionId),
    Promise.resolve((scheduleRow.publishedVersion?.capacitySnapshot ?? []) as unknown as ScheduleCapacityRule[]),
    getScheduleEmployees(facilityId),
  ]);

  const base = toScheduleData(toPeriodRow(scheduleRow), facilityId, employees, capacity, assignments, [], {});
  return base ? { ...base, versionId: publishedVersionId, revision: scheduleRow.publishedVersion?.revision ?? 0 } : null;
}

export async function getCurrentSchedule(facilityId: string): Promise<CurrentScheduleData | null> {
  const today = todayUtcDateForTimeZone(SCHEDULE_TIME_ZONE);

  const schedule = await prisma.schedule.findFirst({
    where: {
      status: 'PUBLISHED',
      facilityId,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: { publishedVersion: true },
    orderBy: { startDate: 'desc' },
  });

  return buildPublishedScheduleData(
    schedule ? { ...schedule, status: PeriodScheduleStatus.PUBLISHED } : null,
    facilityId,
  );
}

export async function getUpcomingSchedule(facilityId: string): Promise<CurrentScheduleData | null> {
  const today = todayUtcDateForTimeZone(SCHEDULE_TIME_ZONE);

  const schedule = await prisma.schedule.findFirst({
    where: {
      status: 'PUBLISHED',
      facilityId,
      startDate: { gt: today },
    },
    include: { publishedVersion: true },
    orderBy: { startDate: 'asc' },
  });

  return buildPublishedScheduleData(
    schedule ? { ...schedule, status: PeriodScheduleStatus.PUBLISHED } : null,
    facilityId,
  );
}

export async function getDraftScheduleData(facilityId: string, scheduleId?: string): Promise<CurrentScheduleData | null> {
  const schedule = await prisma.schedule.findFirst({
    where: {
      facilityId,
      ...(scheduleId ? { id: scheduleId } : { draftVersionId: { not: null }, status: { not: 'ARCHIVED' } }),
    },
    include: { draftVersion: true, publishedVersion: true },
    orderBy: { startDate: 'desc' },
  });
  if (!schedule) return null;

  const version = schedule.draftVersion ?? schedule.publishedVersion;
  const editingVersionId = version?.id ?? null;
  const analysisInput = await loadSchedulingInput(prisma, schedule.id, facilityId, editingVersionId, schedule);
  const { employees, capacity, assignments, warnings, fairness } = loadedScheduleDetails(analysisInput);
  const submittedSubmissions = analysisInput.forms;
  const submittedEmployeeIds = new Set(submittedSubmissions.map((submission) => submission.userId));
  const missingEmployees = employees
    .filter((employee) => !submittedEmployeeIds.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      displayName: employee.displayName,
      positionName: employee.position?.name ?? null,
    }));

  const base = toScheduleData(
    toPeriodRow({ ...schedule, status: periodScheduleStatus(schedule) }),
    facilityId,
    employees,
    capacity,
    assignments,
    warnings,
    {} as OverflowCandidateMap,
  );
  if (!base) return null;

  return {
    ...base, fairness,
    versionId: editingVersionId,
    revision: version?.revision ?? 0,
    hasUnpublishedDraft: !!schedule.draftVersionId,
    editingVersionNumber: version?.number ?? null,
    availabilitySubmissionSummary: {
      submittedCount: submittedEmployeeIds.size,
      eligibleEmployeeCount: employees.length,
      missingEmployees,
    },
  };
}

export async function getScheduleWarnings(scheduleId: string | null | undefined): Promise<ScheduleWarningSummary[]> {
  if (!scheduleId) return [];
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { facilityId: true, draftVersionId: true, publishedVersionId: true },
  });
  if (!schedule) return [];

  const [data, employees, capacity] = await Promise.all([
    loadSchedulingInput(prisma, scheduleId, schedule.facilityId, schedule.draftVersionId ?? schedule.publishedVersionId),
    getScheduleEmployees(schedule.facilityId),
    getScheduleCapacity(schedule.facilityId),
  ]);
  return toWarningSummaries(
    scheduleId,
    analyzeSchedule(data.input, data.allAssignments).warnings,
    employees,
    capacity,
  );
}
