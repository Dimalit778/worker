'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { DayCategory, Position, ShiftType, SystemRole } from '@/generated/prisma/client';
import { parseISODateToUtcMidnight } from '@/features/schedules/utils';
import type { AssignGuardParams, CapacityMap, FullCapacityRules } from './types';

// = להוסיף מאבטח לשיבוץ
export async function assignGuard(params: AssignGuardParams): Promise<{ scheduleId: string }> {
  const session = await requireSession(SystemRole.MANAGER);

  const {
    scheduleId: incomingScheduleId,
    periodId,
    userId,
    courtId,
    date,
    shiftType,
    position,
    slotIndex,
    isOpeningDuty,
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
      employeeId: userId,
      date: parseISODateToUtcMidnight(date),
      shiftType,
      position,
      slotIndex,
      isOpeningDuty,
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

// = לעדכן כללי תקנים במשמרת
export async function upsertCapacityRules(rules: FullCapacityRules): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
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

export type AddShiftRuleParams = {
  shiftType: ShiftType;
  dayCategory: DayCategory;
  position: Position;
  requiredCount: number;
};

// = להוסיף כלל משמרת
export async function addCourtShiftRule(
  params: AddShiftRuleParams,
): Promise<{ ok: true; id: string } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const { shiftType, dayCategory, position, requiredCount } = params;
  if (!Number.isInteger(requiredCount) || requiredCount < 0 || requiredCount > 999) {
    return { error: 'ערך קיבולת לא תקין' };
  }

  const existing = await prisma.courtShiftRule.findUnique({
    where: { courtId_shiftType_dayCategory_position: { courtId, shiftType, dayCategory, position } },
  });
  if (existing) return { error: 'כלל עם אותן הגדרות כבר קיים' };

  const maxOrder = await prisma.courtShiftRule.aggregate({
    where: { courtId, dayCategory, shiftType },
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

  const rule = await prisma.courtShiftRule.create({
    data: { courtId, shiftType, dayCategory, position, requiredCount, displayOrder },
  });

  revalidatePath('/manager/settings');
  revalidatePath('/manager/shifts');
  return { ok: true, id: rule.id };
}

// = לעדכן כלל משמרת
export async function updateCourtShiftRule(
  id: string,
  requiredCount: number,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  if (!Number.isInteger(requiredCount) || requiredCount < 0 || requiredCount > 999) {
    return { error: 'ערך קיבולת לא תקין' };
  }

  const rule = await prisma.courtShiftRule.findUnique({ where: { id } });
  if (!rule || rule.courtId !== courtId) return { error: 'כלל לא נמצא' };

  await prisma.courtShiftRule.update({ where: { id }, data: { requiredCount } });

  revalidatePath('/manager/settings');
  revalidatePath('/manager/shifts');
  return { ok: true };
}

// = למחוק כלל משמרת
export async function deleteCourtShiftRule(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const rule = await prisma.courtShiftRule.findUnique({ where: { id } });
  if (!rule || rule.courtId !== courtId) return { error: 'כלל לא נמצא' };

  await prisma.courtShiftRule.delete({ where: { id } });

  revalidatePath('/manager/settings');
  revalidatePath('/manager/shifts');
  return { ok: true };
}
