'use server';

import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { ShiftAssignment, SystemRole } from '@/generated/prisma/client';
import { parseISODateToUtcMidnight } from '@/features/schedules/utils';
import { revalidatePath } from 'next/cache';
import type { AssignEmployeeToSlotParams } from './types';

export async function assignEmployeeToSlot(params: AssignEmployeeToSlotParams): Promise<{ scheduleId: string }> {
  const session = await requireSession(SystemRole.MANAGER);

  const {
    scheduleId: incomingScheduleId,
    periodId,
    employeeId,
    courtId,
    positionId,
    shiftType,
    date,
    slotIndex,
  } = params;

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
      positionId,
      shiftType,
      date: parseISODateToUtcMidnight(date),
      slotIndex,
      isManualOverride: true,
    },
  });

  revalidatePath('/manager/shifts');
  revalidatePath('/manager/draft');
  return { scheduleId };
}

export async function updateAssignmentEmployee(assignmentId: string, newEmployeeId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: { employeeId: newEmployeeId },
  });

  revalidatePath('/manager/shifts');
  revalidatePath('/manager/draft');
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  await prisma.shiftAssignment.delete({ where: { id: assignmentId } });

  revalidatePath('/manager/shifts');
  revalidatePath('/manager/draft');
}
