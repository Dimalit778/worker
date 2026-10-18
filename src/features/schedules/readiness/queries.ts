'use server';

import { prisma } from '@/lib/db/client';
import { requireManager } from '@/lib/db/auth-helpers';
import { computeManualViolations } from '@/features/scheduling-engine/manual-violations';
import type { EngineAssignment } from '@/features/scheduling-engine/types';
import type { ShiftType } from '@/generated/prisma/client';
import { loadSchedulingInput } from '../generation/queries';
import { loadedScheduleDetails } from '../assignments/loaded-details';
import type { VersionExpectation } from '../services/transactions';
import type { ScheduleWarningSummary } from '../types';
import {
  aggregateEmployeeLoad,
  countByStatus,
  diffVersions,
  SUBMISSION_STATUS_ORDER,
  submissionStatusOf,
  type DiffSlot,
  type EmployeeLoadRow,
  type SlotChange,
  type SubmissionStatus,
} from './utils';

// Relevant employees: active facility users, excluding the rank-1 (manager) role.
const relevantEmployee = { isActive: true, role: { rank: { not: 1 } } };
const SHORTAGE_TYPES = new Set(['UNFILLED', 'UNDERSTAFFED']);

export type SubmissionReadiness = {
  scheduleId: string;
  closesAt: string;
  total: number;
  counts: Record<SubmissionStatus, number>;
  employees: Array<{
    id: string;
    displayName: string;
    roleName: string;
    status: SubmissionStatus;
    submittedAt: string | null;
    draftSavedAt: string | null;
  }>;
};

export async function getSubmissionReadiness(scheduleId: string): Promise<SubmissionReadiness | null> {
  const { facilityId } = await requireManager();
  const schedule = await prisma.schedule.findFirst({ where: { id: scheduleId, facilityId }, select: { id: true, submissionClosesAt: true } });
  if (!schedule) return null;
  const users = await prisma.user.findMany({
    where: { facilityId, ...relevantEmployee },
    select: {
      id: true,
      displayName: true,
      role: { select: { name: true, rank: true } },
      submissions: { where: { scheduleId, facilityId }, select: { submittedAt: true, draftEntries: true, draftSavedAt: true } },
    },
    orderBy: [{ role: { rank: 'asc' } }, { displayName: 'asc' }],
  });
  const employees = users.map((u) => {
    const submission = u.submissions[0] ?? null;
    return {
      id: u.id,
      displayName: u.displayName,
      roleName: u.role.name,
      status: submissionStatusOf(submission),
      submittedAt: submission?.submittedAt?.toISOString() ?? null,
      draftSavedAt: submission?.draftSavedAt?.toISOString() ?? null,
    };
  });
  employees.sort((a, b) => SUBMISSION_STATUS_ORDER.indexOf(a.status) - SUBMISSION_STATUS_ORDER.indexOf(b.status));
  return {
    scheduleId,
    closesAt: schedule.submissionClosesAt.toISOString(),
    total: employees.length,
    counts: countByStatus(employees.map((e) => e.status)),
    employees,
  };
}

export async function getEmployeeLoad(scheduleId: string, versionId: string): Promise<EmployeeLoadRow[]> {
  const { facilityId } = await requireManager();
  const version = await prisma.scheduleVersion.findFirst({ where: { id: versionId, scheduleId, facilityId }, select: { id: true } });
  if (!version) return [];
  const slots = await prisma.scheduleSlot.findMany({
    where: { versionId, scheduleId, facilityId, userId: { not: null } },
    select: { userId: true, date: true, shiftType: true, startsAt: true, endsAt: true },
  });
  const assignedIds = [...new Set(slots.map((s) => s.userId as string))];
  // Inactive employees are listed only when they still hold shifts in this version.
  const users = await prisma.user.findMany({
    where: { facilityId, OR: [relevantEmployee, { id: { in: assignedIds } }] },
    select: { id: true, displayName: true, role: { select: { name: true } } },
  });
  return aggregateEmployeeLoad(
    slots.map((s) => ({ ...s, userId: s.userId as string })),
    users.map((u) => ({ id: u.id, displayName: u.displayName, roleName: u.role.name })),
  );
}

export type ManualException = {
  slotId: string;
  date: string;
  shiftType: ShiftType;
  positionName: string;
  employeeName: string;
  messages: string[];
};

export type PublishReview =
  | { ok: false; error: string }
  | {
      ok: true;
      versionId: string;
      revision: number;
      draftVersionNumber: number;
      publishedVersionNumber: number | null;
      isFirstPublication: boolean;
      /** ERROR warnings — the count publishSchedule asks to confirm. */
      errorCount: number;
      shortages: ScheduleWarningSummary[];
      issues: ScheduleWarningSummary[];
      exceptions: ManualException[];
      changes: SlotChange[];
    };

const toEngine = (a: { userId: string | null; facilityId: string; positionId: string; date: Date; shiftType: ShiftType; slotNumber: number; isLocked: boolean; source: EngineAssignment['source'] }): EngineAssignment => ({
  employeeId: a.userId ?? '', facilityId: a.facilityId, positionId: a.positionId, date: a.date, shiftType: a.shiftType,
  slotIndex: Math.max(0, a.slotNumber - 1), isManualOverride: a.isLocked, source: a.source,
});

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export async function getPublishReview(scheduleId: string, expected: VersionExpectation): Promise<PublishReview> {
  const { facilityId } = await requireManager();
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, facilityId },
    include: { draftVersion: true, publishedVersion: true },
  });
  const draft = schedule?.draftVersion;
  if (!schedule || !draft || draft.status !== 'DRAFT') return { ok: false, error: 'לא נמצאה טיוטה לפרסום' };
  if (expected.versionId !== draft.id || expected.revision !== draft.revision) {
    return { ok: false, error: 'השיבוץ השתנה. יש לרענן ולנסות שוב' };
  }

  const data = await loadSchedulingInput(prisma, scheduleId, facilityId, draft.id, schedule);
  const { warnings } = loadedScheduleDetails(data);
  const errors = warnings.filter((w) => w.severity === 'ERROR');

  const exceptions: ManualException[] = [];
  for (const row of data.assignments) {
    if (row.source !== 'MANUAL' && !row.isLocked) continue;
    const others = data.assignments.filter((a) => a.id !== row.id).map(toEngine);
    const result = computeManualViolations(data.input, others, toEngine(row));
    const messages = [...result.blocking, ...result.violations.map((v) => v.message)];
    if (!messages.length) continue;
    exceptions.push({
      slotId: row.id,
      date: isoDay(row.date),
      shiftType: row.shiftType,
      positionName: row.position?.name ?? '',
      employeeName: row.user?.displayName ?? '',
      messages,
    });
  }
  exceptions.sort((a, b) => a.date.localeCompare(b.date));

  const published = schedule.publishedVersionId
    ? await prisma.scheduleSlot.findMany({
        where: { versionId: schedule.publishedVersionId, scheduleId, facilityId, userId: { not: null } },
        include: { user: { select: { displayName: true } }, position: { select: { name: true } } },
      })
    : [];
  const toDiff = (s: { date: Date; shiftType: ShiftType; positionId: string; userId: string | null; position: { name: string } | null; user: { displayName: string } | null }): DiffSlot => ({
    date: isoDay(s.date), shiftType: s.shiftType, positionId: s.positionId,
    positionName: s.position?.name ?? '', employeeId: s.userId, employeeName: s.user?.displayName ?? null,
  });

  return {
    ok: true,
    versionId: draft.id,
    revision: draft.revision,
    draftVersionNumber: draft.number,
    publishedVersionNumber: schedule.publishedVersion?.number ?? null,
    isFirstPublication: !schedule.publishedVersionId,
    errorCount: errors.length,
    shortages: warnings.filter((w) => SHORTAGE_TYPES.has(w.type)),
    issues: errors.filter((w) => !SHORTAGE_TYPES.has(w.type)),
    exceptions,
    changes: schedule.publishedVersionId ? diffVersions(published.map(toDiff), data.assignments.map(toDiff)) : [],
  };
}
