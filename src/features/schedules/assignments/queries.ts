import { periodScheduleStatus, PeriodScheduleStatus } from '@/features/schedules/period-status';
import { loadSchedulingInput } from '../generation/queries';
import { loadedScheduleDetails } from './loaded-details';
import { analyzeSchedule } from '../generation/recalculate';
import { toWarningSummaries } from '../warnings/summaries';
import { prisma } from '@/lib/db/client';
import {
  OverflowCandidateMap,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
  ScheduleWarningSummary,
  CurrentScheduleData,
} from '../types';
import type { Schedule, ScheduleVersion } from '@/generated/prisma/client';
import { buildAssignmentMap, toScheduleData } from './utils';
import { toDatedCapacityRules, type DatedCapacityRule } from '../utils';
import type { EngineInput } from '@/features/scheduling-engine/types';
import { todayUtcDateForTimeZone } from '@/features/periods/utils';
import { currentScheduleWhere, preparationScheduleWhere, upcomingPublishedWhere } from '../selection';
import { getPublishedSlots } from './published-slots';
import { readFacilityCache } from '@/lib/cache/data-cache';

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

type ScheduleRow = Schedule & { publishedVersion: ScheduleVersion | null };

/** Published capacity is frozen in the version; older snapshots contain only day-category rules. */
export function snapshotCapacity(version: ScheduleVersion | null | undefined): DatedCapacityRule[] | null {
  const snapshot = version?.capacitySnapshot;
  return Array.isArray(snapshot) ? (snapshot as unknown as DatedCapacityRule[]) : null;
}

/** Analyze a published version against its own snapshot instead of today's settings. */
export function withSnapshotRequirements(input: EngineInput, rules: DatedCapacityRule[]): EngineInput {
  return {
    ...input,
    capacities: rules.filter((rule) => !rule.date).map((rule) => ({
      positionId: rule.positionId, positionName: rule.displayName, requiredRank: rule.rank,
      shiftType: rule.shiftType, dayCategory: rule.dayCategory, amount: rule.amount,
    })),
    dateOverrides: rules.flatMap((rule) => rule.date ? [{
      date: rule.date, positionId: rule.positionId, positionName: rule.displayName, requiredRank: rule.rank,
      shiftType: rule.shiftType, amount: rule.amount,
    }] : []),
  };
}

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
  const slots = await getPublishedSlots(
    facilityId, scheduleRow.id, publishedVersionId, scheduleRow.publishedVersion?.revision ?? 0,
  );
  // Include inactive assignees for their display names, while offering only
  // active staff in the picker. Names and eligibility must not be cached.
  const assignedIds = [...new Set(slots.flatMap(slot => slot.userId ? [slot.userId] : []))];
  const people = await prisma.user.findMany({
    where: { facilityId, OR: [staffedUser, { id: { in: assignedIds } }] },
    select: { id: true, displayName: true, isActive: true, role: { select: { id: true, name: true, rank: true } } },
    orderBy: [{ role: { rank: 'asc' } }],
  });
  const names = new Map(people.map(person => [person.id, person.displayName]));
  const employees = people
    .filter(person => person.isActive && person.role.rank !== 1)
    .map(person => ({ id: person.id, displayName: person.displayName, position: person.role }));
  const assignments = buildAssignmentMap(slots.flatMap(slot => {
    const name = slot.userId ? names.get(slot.userId) : undefined;
    if (!slot.userId || name === undefined) return [];
    return [{
      id: slot.id, isLocked: slot.isLocked, startsAt: new Date(slot.startsAt), endsAt: slot.endsAt ? new Date(slot.endsAt) : undefined, date: new Date(slot.date),
      shiftType: slot.shiftType, positionId: slot.positionId, positionName: slot.position.name,
      employeeId: slot.userId, employeeDisplayName: name, slotIndex: slot.slotNumber - 1,
    }];
  }));
  const capacity = snapshotCapacity(scheduleRow.publishedVersion) ?? [];

  const base = toScheduleData(toPeriodRow(scheduleRow), facilityId, employees, capacity, assignments, [], {});
  return base ? { ...base, versionId: publishedVersionId, revision: scheduleRow.publishedVersion?.revision ?? 0 } : null;
}

/** Read the immutable first publication using the same roster presentation. */
export async function getOriginalSchedule(scheduleId: string, facilityId: string): Promise<CurrentScheduleData | null> {
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, facilityId }, include: { originalVersion: true },
  });
  if (!schedule?.originalVersion) return null;
  return buildPublishedScheduleData({
    ...schedule, status: PeriodScheduleStatus.PUBLISHED,
    publishedVersionId: schedule.originalVersion.id, publishedVersion: schedule.originalVersion,
  }, facilityId);
}

/** Employee history uses only the live published version, scoped to the session's facility. */
export async function getPublishedScheduleById(scheduleId: string, facilityId: string): Promise<CurrentScheduleData | null> {
  const schedule = await prisma.schedule.findFirst({
    where: {
      id: scheduleId, facilityId,
      status: { in: ['PUBLISHED', 'ARCHIVED'] },
      publishedVersionId: { not: null },
    },
    include: { publishedVersion: true },
  });
  return buildPublishedScheduleData(schedule, facilityId);
}

export async function getCurrentSchedule(facilityId: string): Promise<CurrentScheduleData | null> {
  const schedule = await prisma.schedule.findFirst({
    where: currentScheduleWhere(facilityId),
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
      ...(scheduleId ? { id: scheduleId } : { OR: [preparationScheduleWhere(facilityId), upcomingPublishedWhere(facilityId)] }),
    },
    include: { draftVersion: true, publishedVersion: true },
    orderBy: { startDate: 'desc' },
  });
  if (!schedule) return null;

  const version = schedule.draftVersion ?? schedule.publishedVersion;
  const editingVersionId = version?.id ?? null;
  return readFacilityCache(facilityId, [
    'draft', schedule.id, editingVersionId ?? 'none', String(version?.revision ?? 0), periodScheduleStatus(schedule),
  ], async () => {
    const loaded = await loadSchedulingInput(prisma, schedule.id, facilityId, editingVersionId, schedule);
    // Draft → live requirements + live date overrides; published version (no draft) → its frozen snapshot.
    const snapshot = version?.status === 'PUBLISHED' ? snapshotCapacity(version) : null;
    const analysisInput = snapshot ? { ...loaded, input: withSnapshotRequirements(loaded.input, snapshot) } : loaded;
    const details = loadedScheduleDetails(analysisInput);
    const { employees, assignments, warnings, fairness } = details;
    const capacity: ScheduleCapacityRule[] = snapshot ?? [...details.capacity, ...toDatedCapacityRules(loaded.dateOverrides)];
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
  });
}

export async function getScheduleWarnings(scheduleId: string | null | undefined, facilityId: string): Promise<ScheduleWarningSummary[]> {
  if (!scheduleId) return [];
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, facilityId },
    select: { draftVersionId: true, publishedVersionId: true, publishedVersion: true },
  });
  if (!schedule) return [];

  const [data, employees, liveCapacity] = await Promise.all([
    loadSchedulingInput(prisma, scheduleId, facilityId, schedule.draftVersionId ?? schedule.publishedVersionId),
    getScheduleEmployees(facilityId),
    getScheduleCapacity(facilityId),
  ]);
  const snapshot = schedule.draftVersionId ? null : snapshotCapacity(schedule.publishedVersion);
  const input = snapshot ? withSnapshotRequirements(data.input, snapshot) : data.input;
  const capacity = snapshot ?? [...liveCapacity, ...toDatedCapacityRules(data.dateOverrides)];
  return toWarningSummaries(
    scheduleId,
    analyzeSchedule(input, data.allAssignments).warnings,
    employees,
    capacity,
  );
}
