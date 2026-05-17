'use server';
import { prisma } from '@/lib/db/client';
import { ScheduleStatus, SystemRole, WarningSeverity } from '@/generated/prisma/client';
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
