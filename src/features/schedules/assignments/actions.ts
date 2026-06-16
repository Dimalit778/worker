'use server';

import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { parseISODateToUtcMidnight } from '@/features/periods/utils';
import { revalidatePath } from 'next/cache';
import type { AssignEmployeeToSlotParams } from '../types';

export async function createAssignment(params: AssignEmployeeToSlotParams): Promise<{ scheduleId: string }> {
  await requireSession(SystemRole.MANAGER);

  const { scheduleId, employeeId, courtId, positionId, shiftType, date, slotIndex } = params;

  const duplicate = await prisma.shiftAssignment.findFirst({
    where: { scheduleId, employeeId, shiftType, date: parseISODateToUtcMidnight(date) },
  });
  if (duplicate) throw new Error('העובד כבר משובץ במשמרת זו');

  await prisma.shiftAssignment.create({
    data: {
      scheduleId,
      employeeId,
      courtId,
      positionId,
      shiftType,
      date: parseISODateToUtcMidnight(date),
      slotIndex,
      isManualOverride: true,
    },
  });

  revalidatePath('/manager/shifts');
  revalidatePath('/manager/draft');
  revalidatePath('/manager/schedule');
  return { scheduleId };
}

export async function updateAssignment(assignmentId: string, newEmployeeId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  const existing = await prisma.shiftAssignment.findUnique({ where: { id: assignmentId } });
  if (existing) {
    const duplicate = await prisma.shiftAssignment.findFirst({
      where: {
        scheduleId: existing.scheduleId,
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

  revalidatePath('/manager/shifts');
  revalidatePath('/manager/draft');
  revalidatePath('/manager/schedule');
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  await prisma.shiftAssignment.delete({ where: { id: assignmentId } });

  revalidatePath('/manager/shifts');
  revalidatePath('/manager/draft');
  revalidatePath('/manager/schedule');
}
