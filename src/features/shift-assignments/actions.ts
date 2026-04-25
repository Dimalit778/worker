'use server';

import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { parseISODateToUtcMidnight } from '@/features/schedules/utils';
import { revalidatePath } from 'next/cache';
import { AssignGuardParams } from './types';

// = להוסיף מאבטח לשיבוץ
export async function assignGuard(params: AssignGuardParams): Promise<{ scheduleId: string }> {
  const session = await requireSession(SystemRole.MANAGER);

  const { scheduleId: incomingScheduleId, periodId, employeeId, courtId, courtShiftRoleId, date, slotIndex } = params;

  let scheduleId = incomingScheduleId;

  if (!scheduleId) {
    const schedule = await prisma.schedule.create({
      data: { periodId, generatedById: session.user.id },
    });
    scheduleId = schedule.id;
  }

  await prisma.shiftAssignment.create({
    data: {
      scheduleId,
      employeeId,
      courtId,
      courtShiftRoleId,
      date: parseISODateToUtcMidnight(date),
      slotIndex,
      isManualOverride: true,
    },
  });

  revalidatePath('/manager/shifts');
  revalidatePath('/manager/draft');
  return { scheduleId };
}
// = להחליף מאבטח בשיבוץ
export async function reassignGuard(assignmentId: string, newUserId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: { employeeId: newUserId },
  });

  revalidatePath('/manager/shifts');
  revalidatePath('/manager/draft');
}
// = להוריד מאבטח משיבוץ
export async function removeAssignment(assignmentId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  await prisma.shiftAssignment.delete({ where: { id: assignmentId } });

  revalidatePath('/manager/shifts');
  revalidatePath('/manager/draft');
}
