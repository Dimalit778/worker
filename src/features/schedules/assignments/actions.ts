'use server';

import { requireManager, requireSession } from '@/lib/db/auth-helpers';
import type { ScheduleSlot, ShiftType } from '@/generated/prisma/client';
import type { AssignEmployeeToSlotParams } from '../types';
import { getCurrentSchedule, getDraftScheduleData, getOriginalSchedule, snapshotCapacity, withSnapshotRequirements } from './queries';
import { scheduleTransaction, checkedVersion, editableDraft, type VersionExpectation } from '../services/transactions';
import { loadSchedulingInput } from '../generation/queries';
import { saveScheduleAnalysis } from '../generation/recalculate';
import { computeManualViolations, type ManualViolation } from '@/features/scheduling-engine/manual-violations';
import { parseISODateToUtcMidnight } from '@/features/periods/utils';
import { prisma } from '@/lib/db/client';
import { loadedScheduleDetails } from './loaded-details';
import { recordSlotChanges } from '../change-log/record';
import { defaultShiftTimes, isValidShiftTime, shiftBounds, type CustomHours } from '../shift-times';

type Edit = { kind: 'create'; params: AssignEmployeeToSlotParams } |
  { kind: 'update'; assignmentId: string; employeeId: string } |
  { kind: 'remove'; assignmentId: string } |
  { kind: 'swap'; assignmentId: string; otherId: string } |
  { kind: 'lock'; assignmentId: string; isLocked: boolean } |
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
      // The screen numbers the filled rows of each cell 0..n-1 in slot-number order (buildAssignmentMap), so its slot
      // index is not a slot number: published removals leave empty rows and draft removals leave gaps.
      // `before` already holds every slot of this version: resolve each screen slot from it once, and keep that
      // binding in step with the writes below so later changes in the batch see earlier ones.
      const cellKey = (date: Date, shiftType: string, positionId: string) => `${date.getTime()}|${shiftType}|${positionId}`;
      const cells = new Map<string, { filled: ScheduleSlot[]; empty: ScheduleSlot[]; lastNumber: number }>();
      for (const row of [...before].sort((a, b) => a.slotNumber - b.slotNumber)) {
        const key = cellKey(row.date, row.shiftType, row.positionId);
        const cell = cells.get(key) ?? { filled: [], empty: [], lastNumber: 0 };
        (row.userId ? cell.filled : cell.empty).push(row);
        cell.lastNumber = row.slotNumber;
        cells.set(key, cell);
      }
      const bound = new Map<string, { row: ScheduleSlot | null; slotNumber?: number }>();
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
        const key = cellKey(date, change.shiftType, change.positionId);
        const cell = cells.get(key) ?? { filled: [], empty: [], lastNumber: 0 };
        cells.set(key, cell);
        const screenSlot = `${key}#${change.slotIndex}`;
        const target = bound.get(screenSlot) ?? { row: cell.filled[change.slotIndex] ?? null };
        target.slotNumber ??= target.row?.slotNumber;
        bound.set(screenSlot, target);
        const slot = target.row;
        if (change.employeeId === null) {
          if (slot) {
            if (direct) target.row = await tx.scheduleSlot.update({ where: { id: slot.id }, data: { userId: null, source: 'MANUAL', isLocked: false } });
            else {
              await tx.scheduleSlot.delete({ where: { id: slot.id } });
              target.row = null;
            }
          }
        } else if (slot) {
          // Custom hours belong to the person: a new employee in the slot starts from the default hours.
          const times = hours !== undefined ? hoursData : slot.userId !== change.employeeId ? defaultBounds : {};
          target.row = await tx.scheduleSlot.update({ where: { id: slot.id }, data: { userId: change.employeeId, source: 'MANUAL', ...times } });
          changedIds.push(slot.id);
        } else if (target.slotNumber === undefined && cell.empty.length) {
          // Published removals keep their rows (stable IDs): fill an emptied row before adding a new one.
          const empty = cell.empty.shift()!;
          target.row = await tx.scheduleSlot.update({ where: { id: empty.id }, data: { userId: change.employeeId, source: 'MANUAL', ...hoursData } });
          target.slotNumber = empty.slotNumber;
          changedIds.push(empty.id);
        } else {
          if (!ownedPositions.has(change.positionId)) {
            const position = await tx.position.findFirst({ where: { id: change.positionId, OR: [{ facilityId: actor.facilityId }, { facilityId: null }] }, select: { id: true } });
            if (!position) throw new Error('התפקיד אינו שייך למתקן');
            ownedPositions.add(change.positionId);
          }
          // A slot deleted earlier in this batch comes back with its number; a new one goes after the cell's last row.
          const slotNumber = target.slotNumber ?? ++cell.lastNumber;
          const created = await tx.scheduleSlot.create({ data: { scheduleId, versionId: version.id, facilityId: actor.facilityId, userId: change.employeeId, positionId: change.positionId, date, shiftType: change.shiftType, slotNumber, ...hoursData, source: 'MANUAL' } });
          target.row = created;
          target.slotNumber = slotNumber;
          changedIds.push(created.id);
        }
      }
    } else if (edit.kind === 'remove') {
      if (direct) await tx.scheduleSlot.update({ where: { id: existing!.id }, data: { userId: null, source: 'MANUAL', isLocked: false } });
      else await tx.scheduleSlot.delete({ where: { id: existing!.id } });
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
    const loaded = await loadSchedulingInput(tx, scheduleId, actor.facilityId, version.id);
    // A published roster is checked against the requirements frozen at publication, as its screen shows them.
    const snapshot = direct ? snapshotCapacity(version) : null;
    const data = snapshot ? { ...loaded, input: withSnapshotRequirements(loaded.input, snapshot) } : loaded;
    // Only the changed rows are checked: a row the edit did not touch may have stopped meeting the rules after
    // it was placed (deactivated employee, approved vacation, changed requirements) and must not block other edits.
    // Manual placements: hard integrity rules block; business rules need an explicit manager approval.
    const violations: ManualViolation[] = [];
    for (const row of data.assignments.filter(a => changedIds.includes(a.id))) {
      const result = computeManualViolations(data.input, data.assignments.filter(a => a.id !== row.id).map(data.toEngine), data.toEngine(row));
      if (result.blocking.length) throw new Error(result.blocking.join('; '));
      const prefix = changedIds.length > 1 ? `${row.user?.displayName ?? ''}: ` : '';
      violations.push(...result.violations.map(v => ({ ...v, message: prefix + v.message })));
    }
    // A batch save needs a typed reason only for an overlapping or too-close shift, including one in the neighbouring
    // published schedule; its other rule violations are saved and recorded in the change log.
    const needsReason = edit.kind === 'batch' ? violations.filter(v => v.code === 'DOUBLE_BOOKED' || v.code === 'REST_GAP') : violations;
    if (needsReason.length && !reason) throw new OverrideRequiredError(needsReason);
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
/** Save several unsaved slot changes at once; all are applied (and validated) together or none are. */
export async function saveScheduleChanges(scheduleId: string, expected: VersionExpectation, changes: SlotChange[], override?: ManualOverride) {
  return editSchedule(scheduleId, expected, { kind: 'batch', changes }, override);
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
