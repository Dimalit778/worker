'use server';
import { prisma } from '@/lib/db/client';
import {
  ScheduleChangeType,
  ScheduleStatus,
  ScheduleVersionStatus,
  SystemRole,
  WarningSeverity,
} from '@/generated/prisma/client';
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

    const draftVersion = await prisma.workScheduleVersion.findFirst({
      where: { scheduleId, status: ScheduleVersionStatus.DRAFT },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (!draftVersion) return { error: 'לא נמצאה גרסת טיוטה לפרסום' };

    const assignments = await prisma.shiftAssignment.findMany({
      where: { versionId: draftVersion.id },
      select: {
        employeeId: true,
        positionId: true,
        courtId: true,
        date: true,
        shiftType: true,
      },
    });

    await prisma.$transaction([
      prisma.workScheduleVersion.updateMany({
        where: {
          scheduleId,
          status: ScheduleVersionStatus.PUBLISHED,
          id: { not: draftVersion.id },
        },
        data: {
          status: ScheduleVersionStatus.ARCHIVED,
          isActive: false,
        },
      }),
      prisma.workScheduleVersion.update({
        where: { id: draftVersion.id },
        data: { status: ScheduleVersionStatus.PUBLISHED, isActive: true, publishedAt: new Date() },
      }),
      prisma.workSchedule.update({
        where: { id: scheduleId },
        data: { status: ScheduleStatus.PUBLISHED, publishedAt: new Date() },
      }),
      prisma.scheduleChangeLog.create({
        data: {
          scheduleId,
          versionId: draftVersion.id,
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
