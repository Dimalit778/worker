'use server';

import { requireManager, requireSession } from '@/lib/db/auth-helpers';
import type { ShiftType } from '@/generated/prisma/client';
import type { AssignEmployeeToSlotParams } from '../types';
import { getCurrentSchedule, getDraftScheduleData, getOriginalSchedule } from './queries';
import { scheduleTransaction, checkedVersion, editableDraft, type VersionExpectation } from '../services/transactions';
import { loadSchedulingInput } from '../generation/queries';
import { saveScheduleAnalysis } from '../generation/recalculate';
import { validateScheduleEdit } from './validate-edit';
import { computeManualViolations, type ManualViolation } from '@/features/scheduling-engine/manual-violations';
import { parseISODateToUtcMidnight } from '@/features/periods/utils';
import { prisma } from '@/lib/db/client';
import { loadedScheduleDetails } from './loaded-details';
import { recordSlotChanges } from '../change-log/record';
import { defaultShiftTimes, isValidShiftTime, shiftBounds, type CustomHours } from '../shift-times';

type Edit = { kind: 'create'; params: AssignEmployeeToSlotParams } |
  { kind: 'update'; assignmentId: string; employeeId: string } |
  { kind: 'remove'; assignmentId: string } |
  { kind: 'batch'; changes: SlotChange[] };

/** One slot's target state in a batch save: an employee, or null to clear the slot. */
export type SlotChange = {
  date: string; shiftType: ShiftType; positionId: string; slotIndex: number; employeeId: string | null;
  /** Custom hours for this slot; null restores the shift's default hours. Omitted: keep, unless the employee changes. */
  hours?: CustomHours | null;
};

export type ManualOverride = { reason: string };
export type OverrideRequired = { ok: false; requiresOverride: true; violations: ManualViolation[] };
class OverrideRequiredError extends Error {
  constructor(readonly violations: ManualViolation[]) { super('נדרש אישור חריגה'); }
}

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
    const edit = requested;
    const checked = await checkedVersion(tx, actor, scheduleId, expected);
    const version = checked.version;
    if (direct) {
      if (checked.schedule.draftVersionId) throw new Error('קיימת טיוטת תיקון פתוחה לשיבוץ זה. יש לפרסם אותה במסך הטיוטה');
      if (!version || version.status !== 'PUBLISHED') throw new Error('השיבוץ אינו מפורסם');
      if (!checked.schedule.originalVersionId) throw new Error('לא נשמר עותק מקור לשיבוץ');
    } else if (!version || version.status !== 'DRAFT') {
      throw new Error('יש לערוך את השיבוץ הנוכחי במסך השיבוץ');
    }
    const before = await tx.scheduleSlot.findMany({ where: { scheduleId, versionId: version.id } });
    const existing = edit.kind === 'create' || edit.kind === 'batch' ? null : before.find(a => a.id === edit.assignmentId);
    if (edit.kind !== 'create' && edit.kind !== 'batch' && !existing) throw new Error('השיבוץ לא נמצא בגרסה הנוכחית');
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
    } else if (edit.kind === 'batch') {
      if (!edit.changes.length) throw new Error('אין שינויים לשמירה');
      // `before` already holds every slot of this version: look slots up here instead of querying per change,
      // and keep the map in step with the writes below so later changes see what a fresh query would.
      const slotKey = (date: Date, shiftType: string, positionId: string, slotNumber: number) => `${date.getTime()}|${shiftType}|${positionId}|${slotNumber}`;
      const slots = new Map(before.map(a => [slotKey(a.date, a.shiftType, a.positionId, a.slotNumber), a]));
      const ownedPositions = new Set<string>();
      for (const change of edit.changes) {
        const date = parseISODateToUtcMidnight(change.date);
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== change.date) throw new Error('תאריך לא תקין');
        const hours = change.hours;
        if (hours && (!isValidShiftTime(hours.startTime) || !isValidShiftTime(hours.endTime) || hours.startTime === hours.endTime)) throw new Error('שעות משמרת לא תקינות');
        const defaults = defaultShiftTimes(change.shiftType);
        const defaultBounds = shiftBounds(date, defaults.startTime, defaults.endTime);
        // Custom hours are a manager decision: lock the slot so automatic scheduling keeps it; clearing them unlocks it.
        const hoursData = hours ? { ...shiftBounds(date, hours.startTime, hours.endTime), isLocked: true } : { ...defaultBounds, isLocked: false };
        const slotNumber = change.slotIndex + 1;
        const key = slotKey(date, change.shiftType, change.positionId, slotNumber);
        const slot = slots.get(key);
        if (change.employeeId === null) {
          if (slot) {
            if (direct) slots.set(key, await tx.scheduleSlot.update({ where: { id: slot.id }, data: { userId: null, source: 'MANUAL', isLocked: false } }));
            else {
              await tx.scheduleSlot.delete({ where: { id: slot.id } });
              slots.delete(key);
            }
          }
        } else if (slot) {
          // Custom hours belong to the person: a new employee in the slot starts from the default hours.
          const times = hours !== undefined ? hoursData : slot.userId !== change.employeeId ? defaultBounds : {};
          slots.set(key, await tx.scheduleSlot.update({ where: { id: slot.id }, data: { userId: change.employeeId, source: 'MANUAL', ...times } }));
          changedIds.push(slot.id);
        } else {
          if (!ownedPositions.has(change.positionId)) {
            const position = await tx.position.findFirst({ where: { id: change.positionId, OR: [{ facilityId: actor.facilityId }, { facilityId: null }] }, select: { id: true } });
            if (!position) throw new Error('התפקיד אינו שייך למתקן');
            ownedPositions.add(change.positionId);
          }
          const created = await tx.scheduleSlot.create({ data: { scheduleId, versionId: version.id, facilityId: actor.facilityId, userId: change.employeeId, positionId: change.positionId, date, shiftType: change.shiftType, slotNumber, ...hoursData, source: 'MANUAL' } });
          slots.set(key, created);
          changedIds.push(created.id);
        }
      }
    } else if (edit.kind === 'remove') {
      if (direct) await tx.scheduleSlot.update({ where: { id: existing!.id }, data: { userId: null, source: 'MANUAL', isLocked: false } });
      else await tx.scheduleSlot.delete({ where: { id: existing!.id } });
    } else {
      await tx.scheduleSlot.update({ where: { id: existing!.id }, data: { userId: edit.employeeId, source: 'MANUAL' } });
      changedIds.push(existing!.id);
    }
    const data = await loadSchedulingInput(tx, scheduleId, actor.facilityId, version.id);
    const failures = await validateScheduleEdit(tx, data.input, data.allAssignments, before.flatMap(slot => slot.userId ? [slot.userId] : []));
    const clearsOnly = edit.kind === 'batch' && edit.changes.every(c => c.employeeId === null);
    if (failures.length && edit.kind !== 'remove' && !clearsOnly) throw new Error(failures.join('; '));
    // Manual placements: hard integrity rules block; business rules need an explicit manager approval.
    const violations: ManualViolation[] = [];
    for (const row of data.assignments.filter(a => changedIds.includes(a.id))) {
      const result = computeManualViolations(data.input, data.assignments.filter(a => a.id !== row.id).map(data.toEngine), data.toEngine(row));
      if (result.blocking.length) throw new Error(result.blocking.join('; '));
      const prefix = changedIds.length > 1 ? `${row.user?.displayName ?? ''}: ` : '';
      violations.push(...result.violations.map(v => ({ ...v, message: prefix + v.message })));
    }
    // A batch save needs no typed reason: rule violations are saved and recorded in the change log.
    if (violations.length && !reason && edit.kind !== 'batch') throw new OverrideRequiredError(violations);
    const details = loadedScheduleDetails(data);
    await tx.scheduleVersion.update({ where: { id: version.id }, data: { revision: { increment: 1 } } });
    await recordSlotChanges(tx, actor, scheduleId, version.id, before, data.assignments, violations, reason);
    return { ok: true as const, scheduleId, revision: version.revision + 1, versionId: version.id, published: direct,
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
export async function removeAssignment(assignmentId: string, expected: VersionExpectation) {
  return editSchedule(await scheduleForAssignment(assignmentId), expected, { kind: 'remove', assignmentId });
}
/** Save several unsaved slot changes at once; all are applied (and validated) together or none are. */
export async function saveScheduleChanges(scheduleId: string, expected: VersionExpectation, changes: SlotChange[]) {
  const result = await applyEdit(scheduleId, expected, { kind: 'batch', changes });
  return result;
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

export async function fetchOriginalSchedule(scheduleId: string) {
  const { facilityId } = await requireManager();
  return getOriginalSchedule(scheduleId, facilityId);
}
