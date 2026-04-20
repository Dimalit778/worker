'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/auth-helpers';
import { DayCategory, Position, ShiftType, SystemRole } from '@/generated/prisma/client';
import { parseISODateToUtcMidnight } from '@/features/schedules/utils';
import type { CapacityMap, FullCapacityRules } from './types';

type AssignGuardParams = {
  scheduleId: string | null;
  periodId: string;
  /** Employee id (picker lists employees). */
  userId: string;
  courtId: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  shiftType: ShiftType;
  position: Position;
  slotIndex: number;
  isOpeningDuty: boolean;
};
// להוסיף מאבטח לשיבוץ
export async function assignGuard(params: AssignGuardParams): Promise<{ scheduleId: string }> {
  const session = await requireSession(SystemRole.MANAGER);

  const { scheduleId: incomingScheduleId, periodId, userId, courtId, date, shiftType, position, slotIndex, isOpeningDuty } = params;

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
      employeeId: userId,
      courtId,
      date: parseISODateToUtcMidnight(date),
      shiftType,
      position,
      slotIndex,
      isOpeningDuty,
      isManualOverride: true,
    },
  });

  revalidatePath('/manager/shifts');
  return { scheduleId };
}
// להחליף מאבטח בשיבוץ
export async function reassignGuard(assignmentId: string, newUserId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: { employeeId: newUserId },
  });

  revalidatePath('/manager/shifts');
}
// להוריד מאבטח משיבוץ
export async function removeAssignment(assignmentId: string): Promise<void> {
  await requireSession(SystemRole.MANAGER);

  await prisma.shiftAssignment.delete({ where: { id: assignmentId } });

  revalidatePath('/manager/shifts');
}

export async function upsertCapacityRules(rules: FullCapacityRules): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.primaryCourtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const shiftKeys: (keyof CapacityMap)[] = ['MORNING', 'EVENING', 'NIGHT'];
  for (const section of [rules.default, rules.friday, rules.saturday]) {
    for (const s of shiftKeys) {
      const v = section[s];
      if (!Number.isInteger(v) || v < 0 || v > 999) return { error: 'ערך קיבולת לא תקין' };
    }
  }

  const shiftTypes: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];
  const dayEntries: { map: CapacityMap; dayCategory: DayCategory }[] = [
    { map: rules.default, dayCategory: DayCategory.WEEKDAY },
    { map: rules.friday, dayCategory: DayCategory.FRIDAY },
    { map: rules.saturday, dayCategory: DayCategory.SATURDAY },
  ];

  try {
    await prisma.$transaction(async (tx) => {
      for (const { map, dayCategory } of dayEntries) {
        for (const shiftType of shiftTypes) {
          const requiredCount = map[shiftType];
          await tx.courtShiftRule.upsert({
            where: {
              courtId_shiftType_dayCategory_position: {
                courtId,
                shiftType,
                dayCategory,
                position: Position.GUARD,
              },
            },
            update: { requiredCount },
            create: {
              courtId,
              shiftType,
              dayCategory,
              position: Position.GUARD,
              requiredCount,
              displayOrder: 0,
            },
          });
        }
      }
    });
  } catch {
    return { error: 'שגיאה בשמירת הכללים' };
  }

  revalidatePath('/manager/settings');
  revalidatePath('/manager/shifts');
  return { ok: true };
}
