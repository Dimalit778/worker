'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/auth-helpers';
import { ShiftType, SystemRole } from '@/generated/prisma/client';
import { parseISODateToUtcMidnight } from '@/features/schedules/utils';

type AssignGuardParams = {
  scheduleId: string | null;
  periodId: string;
  /** Employee id (picker lists employees). */
  userId: string;
  courtId: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  shiftType: ShiftType;
  isOpeningDuty: boolean;
};

export async function assignGuard(params: AssignGuardParams): Promise<{ scheduleId: string }> {
  const session = await requireSession(SystemRole.MANAGER);

  const { scheduleId: incomingScheduleId, periodId, userId, courtId, date, shiftType, isOpeningDuty } = params;

  let scheduleId = incomingScheduleId;

  if (!scheduleId) {
    // Create a new DRAFT schedule for this period
    const schedule = await prisma.schedule.create({
      data: { periodId, generatedById: session.user.id },
    });
    scheduleId = schedule.id;
  }

  await prisma.shiftAssignment.create({
    data: {
      scheduleId,
      employeeId: userId,
      courtId,
      date: parseISODateToUtcMidnight(date),
      shiftType,
      isOpeningDuty,
      isManualOverride: true,
    },
  });

  revalidatePath('/manager/shibutz');
  return { scheduleId };
}

export async function reassignGuard(assignmentId: string, newUserId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: { employeeId: newUserId },
  });

  revalidatePath('/manager/shibutz');
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  await prisma.shiftAssignment.delete({ where: { id: assignmentId } });

  revalidatePath('/manager/shibutz');
}

type CapacityRulesInput = { MORNING: number; EVENING: number; NIGHT: number };

export async function upsertCapacityRules(
  rules: CapacityRulesInput,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.primaryCourtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const shiftTypes: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];

  await prisma.$transaction(async (tx) => {
    for (const shiftType of shiftTypes) {
      const maxStaff = rules[shiftType as keyof CapacityRulesInput];
      const existing = await tx.shiftCapacityRule.findFirst({
        where: { courtId, shiftType, dayOfWeek: null },
      });
      if (existing) {
        await tx.shiftCapacityRule.update({ where: { id: existing.id }, data: { maxStaff } });
      } else {
        await tx.shiftCapacityRule.create({ data: { courtId, shiftType, dayOfWeek: null, minStaff: 0, maxStaff } });
      }
    }
  });

  revalidatePath('/manager/settings');
  revalidatePath('/manager/shibutz');
  return { ok: true };
}
