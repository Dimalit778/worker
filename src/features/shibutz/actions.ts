'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/auth-helpers';
import { ShiftType, SystemRole } from '@/generated/prisma/client';
import { parseISODateToUtcMidnight } from '@/features/schedules/utils';
import type { CapacityMap } from './types';

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

type CapacityRulesInput = CapacityMap;

export async function upsertCapacityRules(
  rules: CapacityRulesInput,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.primaryCourtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const shiftKeys: (keyof CapacityRulesInput)[] = ['MORNING', 'EVENING', 'NIGHT'];
  for (const s of shiftKeys) {
    const v = rules[s];
    if (!Number.isInteger(v) || v < 1 || v > 999) return { error: 'ערך קיבולת לא תקין' };
  }

  const shiftTypes: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];

  try {
    await prisma.$transaction(
      shiftTypes.map((shiftType) =>
        prisma.shiftCapacityRule.upsert({
          // Prisma compound-unique input requires `number` even for nullable columns;
          // at runtime Prisma translates `null` to IS NULL correctly.
          where: { courtId_shiftType_dayOfWeek: { courtId, shiftType, dayOfWeek: null as unknown as number } },
          create: { courtId, shiftType, dayOfWeek: null, minStaff: 0, maxStaff: rules[shiftType as keyof CapacityRulesInput] },
          update: { maxStaff: rules[shiftType as keyof CapacityRulesInput] },
        }),
      ),
    );
  } catch {
    return { error: 'שגיאה בשמירת הכללים' };
  }

  revalidatePath('/manager/settings');
  revalidatePath('/manager/shibutz');
  return { ok: true };
}
