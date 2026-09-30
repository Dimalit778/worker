'use server';

import { requireManager, requireSession } from '@/lib/db/auth-helpers';
import type { AssignEmployeeToSlotParams } from '../types';
import { getCurrentSchedule, getDraftScheduleData } from './queries';
import { scheduleTransaction, checkedVersion, editableDraft, type VersionExpectation } from '../services/transactions';
import { loadSchedulingInput } from '../generation/queries';
import { saveScheduleAnalysis } from '../generation/recalculate';
import { validateAssignments } from '@/features/scheduling-engine/validate';
import { parseISODateToUtcMidnight } from '@/features/periods/utils';
import { prisma } from '@/lib/db/client';

type Edit = { kind: 'create'; params: AssignEmployeeToSlotParams } |
  { kind: 'update'; assignmentId: string; employeeId: string } |
  { kind: 'remove'; assignmentId: string } |
  { kind: 'swap'; assignmentId: string; otherId: string } |
  { kind: 'lock'; assignmentId: string; isLocked: boolean };

async function editSchedule(scheduleId: string, expected: VersionExpectation, edit: Edit) {
  const actor = await requireManager();
  return scheduleTransaction(actor, async tx => {
    const { version } = await checkedVersion(tx, actor, scheduleId, expected);
    if (!version || version.status !== 'DRAFT') throw new Error('יש לפתוח טיוטת תיקון לפני עריכה');
    const before = await tx.shiftAssignment.findMany({ where: { versionId: version.id } });
    const existing = edit.kind === 'create' ? null : before.find(a => a.id === edit.assignmentId);
    if (edit.kind !== 'create' && !existing) throw new Error('השיבוץ לא נמצא בגרסה הנוכחית');
    if (edit.kind === 'create') {
      const p = edit.params;
      const date = parseISODateToUtcMidnight(p.date);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== p.date) throw new Error('תאריך לא תקין');
      await tx.shiftAssignment.create({ data: { scheduleId, versionId: version.id, facilityId: actor.facilityId, employeeId: p.employeeId, shiftRoleId: p.positionId, date, shiftType: p.shiftType, source: 'MANUAL', isLocked: false } });
    } else if (edit.kind === 'remove') {
      await tx.shiftAssignment.delete({ where: { id: existing!.id } });
    } else if (edit.kind === 'lock') {
      await tx.shiftAssignment.update({ where: { id: existing!.id }, data: { isLocked: edit.isLocked } });
    } else if (edit.kind === 'update') {
      await tx.shiftAssignment.update({ where: { id: existing!.id }, data: { employeeId: edit.employeeId, source: 'MANUAL' } });
    } else {
      const other = before.find(a => a.id === edit.otherId);
      if (!other || other.id === existing!.id) throw new Error('יש לבחור שני שיבוצים שונים באותה טיוטה');
      // Delete/reinsert together to avoid transient uniqueness violations during a swap.
      await tx.shiftAssignment.deleteMany({ where: { id: { in: [existing!.id, other.id] } } });
      await tx.shiftAssignment.createMany({ data: [{ ...existing!, employeeId: other.employeeId, source: 'MANUAL' }, { ...other, employeeId: existing!.employeeId, source: 'MANUAL' }] });
    }
    const data = await loadSchedulingInput(tx, scheduleId, actor.facilityId, version.id);
    const failures = validateAssignments(data.input, data.allAssignments);
    if (failures.length && edit.kind !== 'remove' && edit.kind !== 'lock') throw new Error(failures.join('; '));
    await saveScheduleAnalysis(tx, version.id, data.input, data.allAssignments);
    await tx.rosterVersion.update({ where: { id: version.id }, data: { revision: { increment: 1 } } });
    await tx.scheduleChangeLog.create({ data: { scheduleId, versionId: version.id, changedById: actor.userId, changeType: edit.kind === 'create' ? 'CREATE' : edit.kind === 'remove' ? 'DELETE' : 'UPDATE', message: `עדכון טיוטה: ${edit.kind}`, beforeData: JSON.parse(JSON.stringify(before)), afterData: JSON.parse(JSON.stringify(data.assignments)) } });
    return { scheduleId };
  });
}

async function scheduleForAssignment(assignmentId: string) {
  const { facilityId } = await requireManager();
  const assignment = await prisma.shiftAssignment.findFirst({ where: { id: assignmentId, facilityId }, select: { scheduleId: true } });
  if (!assignment) throw new Error('השיבוץ לא נמצא');
  return assignment.scheduleId;
}
export async function createAssignment(params: AssignEmployeeToSlotParams, expected: VersionExpectation) {
  return editSchedule(params.scheduleId, expected, { kind: 'create', params });
}
export async function updateAssignment(assignmentId: string, employeeId: string, expected: VersionExpectation) {
  return editSchedule(await scheduleForAssignment(assignmentId), expected, { kind: 'update', assignmentId, employeeId });
}
export async function updateAssignmentEmployee(assignmentId: string, employeeId: string, expected: VersionExpectation) {
  return updateAssignment(assignmentId, employeeId, expected);
}
export async function removeAssignment(assignmentId: string, expected: VersionExpectation) {
  return editSchedule(await scheduleForAssignment(assignmentId), expected, { kind: 'remove', assignmentId });
}
export async function swapAssignments(assignmentId: string, otherId: string, expected: VersionExpectation) {
  return editSchedule(await scheduleForAssignment(assignmentId), expected, { kind: 'swap', assignmentId, otherId });
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
