'use server';

import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { parseISODateToUtcMidnight } from '@/features/periods/utils';
import type { AssignEmployeeToSlotParams } from '../types';
import { getLatestDraftVersionId } from '@/features/schedules/versions/queries';
import { getActiveSchedule, getDraftScheduleData } from './queries';

export async function createAssignment(params: AssignEmployeeToSlotParams): Promise<{ scheduleId: string }> {
  await requireSession(SystemRole.MANAGER);

  const { scheduleId, employeeId, courtId, positionId, shiftType, date } = params;

  const versionId = await getLatestDraftVersionId(scheduleId);
  if (!versionId) throw new Error('לא נמצאה גרסת טיוטה לעריכה');

  const parsedDate = parseISODateToUtcMidnight(date);

  const duplicate = await prisma.shiftAssignment.findFirst({
    where: { versionId, employeeId, shiftType, date: parsedDate },
  });
  if (duplicate) throw new Error('העובד כבר משובץ במשמרת זו');

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

  return { scheduleId };
}

export async function updateAssignment(assignmentId: string, newEmployeeId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  const existing = await prisma.shiftAssignment.findUnique({ where: { id: assignmentId } });
  if (existing) {
    const duplicate = await prisma.shiftAssignment.findFirst({
      where: {
        versionId: existing.versionId,
        employeeId: newEmployeeId,
        shiftType: existing.shiftType,
        date: existing.date,
        NOT: { id: assignmentId },
      },
    });
    if (duplicate) throw new Error('העובד כבר משובץ במשמרת זו');
  }

  await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: { employeeId: newEmployeeId },
  });

}

export async function removeAssignment(assignmentId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  await prisma.shiftAssignment.delete({ where: { id: assignmentId } });

}


export async function fetchActiveSchedule() {
  const session = await requireSession(SystemRole.MANAGER);
  if (!session.user.courtId) return null;
  return getActiveSchedule(session.user.courtId);
}

export async function fetchDraftSchedule() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';
  return getDraftScheduleData(courtId);
}


export async function fetchEmployeeActiveSchedule() {
  const session = await requireSession(SystemRole.EMPLOYEE);
  if (!session.user.courtId) return null;
  return getActiveSchedule(session.user.courtId);
}
