'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { DayCategory, Position, ShiftType, SystemRole } from '@/generated/prisma/client';
import { parseISODateToUtcMidnight } from '@/features/schedules/utils';
import type { FullCapacityRules, CapacityMap } from './types';
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
          await tx.courtShiftRole.upsert({
            where: {
              courtId_code_shiftType: { courtId, code: shiftType, shiftType },
            },
            update: { isActive: true },
            create: {
              courtId,
              code: shiftType,
              name: shiftType,
              shiftType,
              isActive: true,
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

// = להוסיף כלל משמרת
export async function addCourtShiftRule(
  shiftType: ShiftType,
  dayCategory: DayCategory,
  position: Position,
  requiredCount: number,
): Promise<{ ok: true; id: string } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  if (!Number.isInteger(requiredCount) || requiredCount < 0 || requiredCount > 999) {
    return { error: 'ערך קיבולת לא תקין' };
  }

  const existing = await prisma.courtShiftRole.findUnique({
    where: { courtId_code_shiftType: { courtId, code: shiftType, shiftType } },
  });
  if (existing) return { error: 'כלל עם אותן הגדרות כבר קיים' };

  const rule = await prisma.courtShiftRole.create({
    data: { courtId, code: shiftType, name: shiftType, shiftType, isActive: true, displayOrder: 0 },
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

  const rule = await prisma.courtShiftRole.findUnique({ where: { id } });
  if (!rule || rule.courtId !== courtId) return { error: 'כלל לא נמצא' };

  await prisma.courtShiftRole.update({ where: { id }, data: { isActive: true } });

  revalidatePath('/manager/settings');
  revalidatePath('/manager/shifts');
  return { ok: true };
}

// = למחוק כלל משמרת
export async function deleteCourtShiftRule(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const rule = await prisma.courtShiftRole.findUnique({ where: { id } });
  if (!rule || rule.courtId !== courtId) return { error: 'כלל לא נמצא' };

  await prisma.courtShiftRole.delete({ where: { id } });

  revalidatePath('/manager/settings');
  revalidatePath('/manager/shifts');
  return { ok: true };
}
