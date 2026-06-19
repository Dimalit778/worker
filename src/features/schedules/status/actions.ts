'use server';
import { prisma } from '@/lib/db/client';
import { ScheduleChangeType, ScheduleStatus, SystemRole, WarningSeverity } from '@/generated/prisma/client';
import { requireSession } from '@/lib/db/auth-helpers';

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

// = לסיים עריכת שיבוץ (בדיקת שגיאות בלבד — אין עוד סטטוס ביניים אחרי DRAFT)
export async function finalizeSchedule(scheduleId: string): Promise<{ ok: true } | { error: string }> {
  await requireSession(SystemRole.MANAGER);

  try {
    const errorMessage = await getOpenErrorWarningsMessage(scheduleId);
    if (errorMessage) return { error: errorMessage };

    return { ok: true };
  } catch {
    return { error: 'שגיאה בסיום עריכת השיבוץ' };
  }
}
// = לפרסם שיבוץ
export async function publishSchedule(scheduleId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);

  try {
    const errorMessage = await getOpenErrorWarningsMessage(scheduleId);
    if (errorMessage) return { error: errorMessage };

    const assignments = await prisma.shiftAssignment.findMany({
      where: { scheduleId },
      select: {
        employeeId: true,
        positionId: true,
        courtId: true,
        date: true,
        shiftType: true,
      },
    });

    await prisma.$transaction([
      prisma.workSchedule.update({
        where: { id: scheduleId },
        data: { status: ScheduleStatus.PUBLISHED, publishedAt: new Date() },
      }),
      prisma.scheduleChangeLog.create({
        data: {
          scheduleId,
          changedById: session.user.id,
          changeType: ScheduleChangeType.PUBLISH,
          beforeData: assignments,
        },
      }),
    ]);

    return { ok: true };
  } catch {
    return { error: 'שגיאה בפרסום השיבוץ' };
  }
}
