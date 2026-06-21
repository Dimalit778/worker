'use server';

import { requireManager, requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { parseISODateToUtcMidnight } from '@/features/periods/utils';
import type { AssignEmployeeToSlotParams } from '../types';
import { getLatestDraftVersionId } from '@/features/schedules/versions/queries';
import { getCurrentSchedule, getDraftScheduleData } from './queries';
import { recalculateScheduleAnalysis } from '@/features/schedules/generation/recalculate';
import { addDays, hasShiftConflict } from '@/features/scheduling-engine/constraints';
import type { ShiftType as EngineShiftType } from '@/features/scheduling-engine/types';

async function findConflictingAssignment(params: {
  versionId: string;
  employeeId: string;
  date: Date;
  shiftType: EngineShiftType;
  excludeAssignmentId?: string;
}): Promise<{ id: string } | null> {
  const nearbyAssignments = await prisma.shiftAssignment.findMany({
    where: {
      versionId: params.versionId,
      employeeId: params.employeeId,
      date: {
        gte: addDays(params.date, -1),
        lte: addDays(params.date, 1),
      },
      ...(params.excludeAssignmentId ? { NOT: { id: params.excludeAssignmentId } } : {}),
    },
    select: { id: true, date: true, shiftType: true },
  });

  return (
    nearbyAssignments.find((assignment) =>
      hasShiftConflict(
        assignment.date,
        assignment.shiftType as EngineShiftType,
        params.date,
        params.shiftType
      )
    ) ?? null
  );
}

export async function createAssignment(params: AssignEmployeeToSlotParams): Promise<{ scheduleId: string }> {
  const { courtId } = await requireManager();

  const { scheduleId, employeeId, positionId, shiftType, date } = params;

  const schedule = await prisma.workSchedule.findFirst({
    where: {
      id: scheduleId,
      courtId,
      status: { not: 'ARCHIVED' },
    },
    select: {
      id: true,
      period: { select: { startDate: true, endDate: true } },
    },
  });
  if (!schedule) throw new Error('השיבוץ לא נמצא');

  const versionId = await getLatestDraftVersionId(scheduleId);
  if (!versionId) throw new Error('לא נמצאה גרסת טיוטה לעריכה');

  const parsedDate = parseISODateToUtcMidnight(date);
  if (parsedDate < schedule.period.startDate || parsedDate > schedule.period.endDate) {
    throw new Error('התאריך לא נמצא בתקופת השיבוץ');
  }

  const [employee, position] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: employeeId, courtId, isActive: true, position: { code: { not: 1 } } },
      select: { id: true },
    }),
    prisma.position.findFirst({
      where: { id: positionId, courtId, isActive: true, code: { not: 1 } },
      select: { id: true },
    }),
  ]);
  if (!employee) throw new Error('העובד לא נמצא בבית המשפט הזה');
  if (!position) throw new Error('התפקיד לא נמצא בבית המשפט הזה');

  const duplicate = await findConflictingAssignment({
    versionId,
    employeeId,
    date: parsedDate,
    shiftType: shiftType as EngineShiftType,
  });
  if (duplicate) throw new Error('העובד כבר משובץ במשמרת חופפת או צמודה');

  await prisma.shiftAssignment.create({
    data: {
      scheduleId,
      versionId,
      employeeId,
      courtId,
      positionId,
      shiftType,
      date: parsedDate,
    },
  });

  await recalculateScheduleAnalysis(scheduleId);

  return { scheduleId };
}

export async function updateAssignment(assignmentId: string, newEmployeeId: string): Promise<void> {
  const { courtId } = await requireManager();

  const existing = await prisma.shiftAssignment.findFirst({
    where: { id: assignmentId, courtId },
    select: { id: true, scheduleId: true, versionId: true, shiftType: true, date: true },
  });
  if (!existing) throw new Error('השיבוץ לא נמצא');

  const employee = await prisma.employee.findFirst({
    where: { id: newEmployeeId, courtId, isActive: true, position: { code: { not: 1 } } },
    select: { id: true },
  });
  if (!employee) {
    throw new Error('העובד לא נמצא בבית המשפט הזה');
  }

  const duplicate = await findConflictingAssignment({
    versionId: existing.versionId,
    employeeId: newEmployeeId,
    date: existing.date,
    shiftType: existing.shiftType as EngineShiftType,
    excludeAssignmentId: assignmentId,
  });
  if (duplicate) throw new Error('העובד כבר משובץ במשמרת חופפת או צמודה');

  await prisma.shiftAssignment.updateMany({
    where: { id: assignmentId, courtId },
    data: { employeeId: newEmployeeId },
  });

  await recalculateScheduleAnalysis(existing.scheduleId);
}

export async function updateAssignmentEmployee(assignmentId: string, newEmployeeId: string): Promise<void> {
  const { courtId } = await requireManager();

  const existing = await prisma.shiftAssignment.findFirst({
    where: {
      id: assignmentId,
      courtId,
    },
    select: {
      id: true,
      scheduleId: true,
      versionId: true,
      shiftType: true,
      date: true,
      courtId: true,
    },
  });

  if (!existing) {
    throw new Error('השיבוץ לא נמצא');
  }

  const employee = await prisma.employee.findFirst({
    where: {
      id: newEmployeeId,
      courtId,
      isActive: true,
      position: { code: { not: 1 } },
    },
    select: { id: true },
  });

  if (!employee) {
    throw new Error('העובד לא נמצא בבית המשפט הזה');
  }

  const duplicate = await findConflictingAssignment({
    versionId: existing.versionId,
    employeeId: newEmployeeId,
    date: existing.date,
    shiftType: existing.shiftType as EngineShiftType,
    excludeAssignmentId: assignmentId,
  });

  if (duplicate) {
    throw new Error('העובד כבר משובץ במשמרת חופפת או צמודה');
  }

  await prisma.shiftAssignment.updateMany({
    where: {
      id: assignmentId,
      courtId,
    },
    data: {
      employeeId: newEmployeeId,
    },
  });

  await recalculateScheduleAnalysis(existing.scheduleId);
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  const { courtId } = await requireManager();

  const existing = await prisma.shiftAssignment.findFirst({
    where: { id: assignmentId, courtId },
    select: { scheduleId: true },
  });
  if (!existing) {
    throw new Error('השיבוץ לא נמצא');
  }

  const deleted = await prisma.shiftAssignment.deleteMany({ where: { id: assignmentId, courtId } });
  if (deleted.count === 0) {
    throw new Error('השיבוץ לא נמצא');
  }

  await recalculateScheduleAnalysis(existing.scheduleId);
}

export async function fetchCurrentSchedule() {
  const session = await requireSession(SystemRole.MANAGER);
  if (!session.user.courtId) return null;
  return getCurrentSchedule(session.user.courtId);
}

export async function fetchDraftSchedule() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';
  return getDraftScheduleData(courtId);
}

export async function fetchEmployeeCurrentSchedule() {
  const session = await requireSession(SystemRole.EMPLOYEE);
  if (!session.user.courtId) return null;
  return getCurrentSchedule(session.user.courtId);
}
