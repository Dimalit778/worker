'use server';
import { prisma } from '@/lib/db/client';
import {
  ScheduleStatus,
  SystemRole,
  WarningSeverity,
} from '@/generated/prisma/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { parseISODateToUtcMidnight } from '@/features/periods/utils';
import { revalidatePath } from 'next/cache';
import type { AssignEmployeeToSlotParams } from './types';

async function getOpenErrorWarningsMessage(scheduleId: string): Promise<string | null> {
  const errorCount = await prisma.scheduleWarning.count({
    where: {
      scheduleId,
      severity: WarningSeverity.ERROR,
    },
  });

  if (errorCount === 0) return null;
  return `לא ניתן לאשר או לפרסם שיבוץ עם ${errorCount} שגיאות פתוחות`;
}

// = לסיים עריכת שיבוץ
export async function finalizeSchedule(scheduleId: string): Promise<{ ok: true } | { error: string }> {
  await requireSession(SystemRole.MANAGER);

  try {
    const errorMessage = await getOpenErrorWarningsMessage(scheduleId);
    if (errorMessage) return { error: errorMessage };

    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { status: ScheduleStatus.FINALIZED },
    });
    revalidatePath('/manager/draft');
    return { ok: true };
  } catch {
    return { error: 'שגיאה בסיום עריכת השיבוץ' };
  }
}
// = לפרסם שיבוץ
export async function publishSchedule(scheduleId: string): Promise<{ ok: true } | { error: string }> {
  await requireSession(SystemRole.MANAGER);

  try {
    const errorMessage = await getOpenErrorWarningsMessage(scheduleId);
    if (errorMessage) return { error: errorMessage };

    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { status: ScheduleStatus.PUBLISHED, publishedAt: new Date() },
    });
    revalidatePath('/manager/draft');
    revalidatePath('/user/schedule');
    return { ok: true };
  } catch {
    return { error: 'שגיאה בפרסום השיבוץ' };
  }
}

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
