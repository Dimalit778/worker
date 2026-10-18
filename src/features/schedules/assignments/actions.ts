'use server';

import { requireManager, requireSession } from '@/lib/db/auth-helpers';
import type { AssignEmployeeToSlotParams } from '../types';
import { getCurrentSchedule, getDraftScheduleData } from './queries';
import { scheduleTransaction, checkedVersion, editableDraft, freezePublishedVersion, type VersionExpectation } from '../services/transactions';
import { loadSchedulingInput } from '../generation/queries';
import { saveScheduleAnalysis } from '../generation/recalculate';
import { validateAssignments } from '@/features/scheduling-engine/validate';
import { computeManualViolations, type ManualViolation } from '@/features/scheduling-engine/manual-violations';
import type { EngineAssignment } from '@/features/scheduling-engine/types';
import { parseISODateToUtcMidnight } from '@/features/periods/utils';
import { prisma } from '@/lib/db/client';
import { loadedScheduleDetails } from './loaded-details';
import { defaultShiftTimes, isValidShiftTime, shiftBounds } from '../shift-times';

type Edit = { kind: 'create'; params: AssignEmployeeToSlotParams } |
  { kind: 'update'; assignmentId: string; employeeId: string } |
  { kind: 'remove'; assignmentId: string } |
  { kind: 'swap'; assignmentId: string; otherId: string } |
  { kind: 'lock'; assignmentId: string; isLocked: boolean };

export type ManualOverride = { reason: string };
export type OverrideRequired = { ok: false; requiresOverride: true; violations: ManualViolation[] };
class OverrideRequiredError extends Error {
  constructor(readonly violations: ManualViolation[]) { super('נדרש אישור חריגה'); }
}

const toEngineAssignment = (a: { userId: string | null; facilityId: string; positionId: string; date: Date; shiftType: EngineAssignment['shiftType']; slotNumber: number; isLocked: boolean; source: EngineAssignment['source'] }): EngineAssignment => ({
  employeeId: a.userId ?? '', facilityId: a.facilityId, positionId: a.positionId, date: a.date, shiftType: a.shiftType,
  slotIndex: Math.max(0, a.slotNumber - 1), isManualOverride: a.isLocked, source: a.source,
});

async function editSchedule(scheduleId: string, expected: VersionExpectation, edit: Edit, override?: ManualOverride) {
  try {
    return await applyEdit(scheduleId, expected, edit, override);
  } catch (error) {
    if (error instanceof OverrideRequiredError) return { ok: false, requiresOverride: true, violations: error.violations } as OverrideRequired;
    throw error;
  }
}

async function applyEdit(scheduleId: string, expected: VersionExpectation, requested: Edit, override?: ManualOverride) {
  const reason = override?.reason?.trim();
  if (override && (!reason || reason.length < 3)) throw new Error('יש לציין סיבה לחריגה');
  const actor = await requireManager();
  return scheduleTransaction(actor, async tx => {
    const direct = expected?.publish === true;
    let edit = requested;
    const checked = await checkedVersion(tx, actor, scheduleId, expected);
    let version = checked.version;
    if (direct) {
      // Published slots are immutable: copy them into a new version, edit it, then publish it below.
      if (checked.schedule.draftVersionId) throw new Error('קיימת טיוטת תיקון פתוחה לשיבוץ זה. יש לפרסם אותה במסך הטיוטה');
      if (!version || version.status !== 'PUBLISHED') throw new Error('השיבוץ אינו מפורסם');
      const published = await tx.scheduleSlot.findMany({ where: { versionId: version.id } });
      version = (await editableDraft(tx, actor, scheduleId, expected, 'עריכה ישירה של שיבוץ מפורסם')).version;
      const copies = await tx.scheduleSlot.findMany({ where: { versionId: version.id } });
      const key = (a: { date: Date; shiftType: string; positionId: string; slotNumber: number }) => `${a.date.toISOString()}|${a.shiftType}|${a.positionId}|${a.slotNumber}`;
      const copyIds = new Map(copies.map(a => [key(a), a.id]));
      const mapId = (id: string) => { const slot = published.find(a => a.id === id); return (slot && copyIds.get(key(slot))) ?? id; };
      if (requested.kind === 'swap') edit = { ...requested, assignmentId: mapId(requested.assignmentId), otherId: mapId(requested.otherId) };
      else if (requested.kind !== 'create') edit = { ...requested, assignmentId: mapId(requested.assignmentId) };
    }
    if (!version || version.status !== 'DRAFT') throw new Error('יש לפתוח טיוטת תיקון לפני עריכה');
    const before = await tx.scheduleSlot.findMany({ where: { scheduleId, versionId: version.id } });
    const existing = edit.kind === 'create' ? null : before.find(a => a.id === edit.assignmentId);
    if (edit.kind !== 'create' && !existing) throw new Error('השיבוץ לא נמצא בגרסה הנוכחית');
    const changedIds: string[] = [];
    if (edit.kind === 'create') {
      const p = edit.params;
      const date = parseISODateToUtcMidnight(p.date);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== p.date) throw new Error('תאריך לא תקין');
      const hasTimes = p.startTime !== undefined || p.endTime !== undefined;
      if (hasTimes && (!p.startTime || !p.endTime || !isValidShiftTime(p.startTime) || !isValidShiftTime(p.endTime) || p.startTime === p.endTime)) throw new Error('שעות משמרת לא תקינות');
      const position = await tx.position.findFirst({ where: { id: p.positionId, OR: [{ facilityId: actor.facilityId }, { facilityId: null }] }, select: { id: true } });
      if (!position) throw new Error('התפקיד אינו שייך למתקן');
      const defaults = defaultShiftTimes(p.shiftType);
      const bounds = shiftBounds(date, p.startTime || defaults.startTime, p.endTime || defaults.endTime);
      const last = await tx.scheduleSlot.aggregate({ where: { scheduleId, versionId: version.id, date, shiftType: p.shiftType, positionId: p.positionId }, _max: { slotNumber: true } });
      const created = await tx.scheduleSlot.create({ data: { scheduleId, versionId: version.id, facilityId: actor.facilityId, userId: p.employeeId, positionId: p.positionId, date, shiftType: p.shiftType, slotNumber: (last._max.slotNumber ?? 0) + 1, ...bounds, source: 'MANUAL', isLocked: false } });
      changedIds.push(created.id);
    } else if (edit.kind === 'remove') {
      await tx.scheduleSlot.delete({ where: { id: existing!.id } });
    } else if (edit.kind === 'lock') {
      await tx.scheduleSlot.update({ where: { id: existing!.id }, data: { isLocked: edit.isLocked } });
    } else if (edit.kind === 'update') {
      await tx.scheduleSlot.update({ where: { id: existing!.id }, data: { userId: edit.employeeId, source: 'MANUAL' } });
      changedIds.push(existing!.id);
    } else {
      const other = before.find(a => a.id === edit.otherId);
      if (!other || other.id === existing!.id) throw new Error('יש לבחור שני שיבוצים שונים באותה טיוטה');
      await tx.scheduleSlot.update({ where: { id: existing!.id }, data: { userId: other.userId, source: 'MANUAL' } });
      await tx.scheduleSlot.update({ where: { id: other.id }, data: { userId: existing!.userId, source: 'MANUAL' } });
      changedIds.push(existing!.id, other.id);
    }
    const data = await loadSchedulingInput(tx, scheduleId, actor.facilityId, version.id);
    const failures = validateAssignments(data.input, data.allAssignments);
    if (failures.length && edit.kind !== 'remove' && edit.kind !== 'lock') throw new Error(failures.join('; '));
    // Manual placements: hard integrity rules block; business rules need an explicit manager approval.
    const violations: ManualViolation[] = [];
    for (const row of data.assignments.filter(a => changedIds.includes(a.id))) {
      const result = computeManualViolations(data.input, data.assignments.filter(a => a.id !== row.id).map(toEngineAssignment), toEngineAssignment(row));
      if (result.blocking.length) throw new Error(result.blocking.join('; '));
      const prefix = changedIds.length > 1 ? `${row.user?.displayName ?? ''}: ` : '';
      violations.push(...result.violations.map(v => ({ ...v, message: prefix + v.message })));
    }
    if (violations.length && !reason) throw new OverrideRequiredError(violations);
    const details = loadedScheduleDetails(data);
    await tx.scheduleVersion.update({ where: { id: version.id }, data: { revision: { increment: 1 } } });
    await tx.scheduleChange.create({ data: { facilityId: actor.facilityId, scheduleId, versionId: version.id, changedById: actor.userId, changeType: violations.length ? 'MANUAL_OVERRIDE' : edit.kind === 'create' ? 'CREATE' : edit.kind === 'remove' ? 'DELETE' : 'UPDATE', reason: violations.length ? reason : `עדכון טיוטה: ${edit.kind}`, beforeData: JSON.parse(JSON.stringify(before)), afterData: JSON.parse(JSON.stringify(violations.length ? { violations, approvedById: actor.userId, approvedAt: new Date().toISOString(), assignments: data.assignments } : data.assignments)) } });
    if (direct) {
      await saveScheduleAnalysis(tx, version.id, data.input, data.allAssignments);
      await freezePublishedVersion(tx, version.id, data.capacities, new Date());
      await tx.schedule.update({ where: { id: scheduleId }, data: { publishedVersionId: version.id, draftVersionId: null } });
    }
    return { ok: true as const, scheduleId, revision: version.revision + (direct ? 2 : 1), versionId: version.id, published: direct,
      assignments: details.assignments, warnings: details.warnings, fairness: details.fairness };
  });
}

async function scheduleForAssignment(assignmentId: string) {
  const { facilityId } = await requireManager();
  const assignment = await prisma.scheduleSlot.findFirst({ where: { id: assignmentId, facilityId }, select: { scheduleId: true } });
  if (!assignment) throw new Error('השיבוץ לא נמצא');
  return assignment.scheduleId;
}
export async function createAssignment(params: AssignEmployeeToSlotParams, expected: VersionExpectation, override?: ManualOverride) {
  return editSchedule(params.scheduleId, expected, { kind: 'create', params }, override);
}
export async function updateAssignment(assignmentId: string, employeeId: string, expected: VersionExpectation, override?: ManualOverride) {
  return editSchedule(await scheduleForAssignment(assignmentId), expected, { kind: 'update', assignmentId, employeeId }, override);
}
export async function updateAssignmentEmployee(assignmentId: string, employeeId: string, expected: VersionExpectation, override?: ManualOverride) {
  return updateAssignment(assignmentId, employeeId, expected, override);
}
export async function removeAssignment(assignmentId: string, expected: VersionExpectation) {
  return editSchedule(await scheduleForAssignment(assignmentId), expected, { kind: 'remove', assignmentId });
}
export async function swapAssignments(assignmentId: string, otherId: string, expected: VersionExpectation, override?: ManualOverride) {
  return editSchedule(await scheduleForAssignment(assignmentId), expected, { kind: 'swap', assignmentId, otherId }, override);
}
export async function setAssignmentLocked(assignmentId: string, isLocked: boolean, expected: VersionExpectation) {
  return editSchedule(await scheduleForAssignment(assignmentId), expected, { kind: 'lock', assignmentId, isLocked });
}
export async function startScheduleCorrection(scheduleId: string, expected: VersionExpectation) {
  const actor = await requireManager();
  return scheduleTransaction(actor, async tx => {
    const { version } = await editableDraft(tx, actor, scheduleId, expected);
    const data = await loadSchedulingInput(tx, scheduleId, actor.facilityId, version.id);
    await saveScheduleAnalysis(tx, version.id, data.input, data.allAssignments);
    return { versionId: version.id, revision: version.revision };
  });
}
export async function fetchCurrentSchedule() {
  const session = await requireSession();
  if (!session.user.facilityId) return null;
  return getCurrentSchedule(session.user.facilityId);
}
export async function fetchDraftSchedule(scheduleId?: string) {
  const { facilityId } = await requireManager();
  return getDraftScheduleData(facilityId, scheduleId);
}
