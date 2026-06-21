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

type PublishScheduleResult =
  | { ok: true }
  | { requiresConfirmation: true; issueCount: number; message: string }
  | { error: string };

async function getOpenErrorWarningsMessage(scheduleId: string, courtId: string): Promise<string | null> {
  const errorCount = await prisma.scheduleWarning.count({
    where: {
      scheduleId,
      schedule: { courtId },
      severity: WarningSeverity.ERROR,
    },
  });

  if (errorCount === 0) return null;
  return `לא ניתן לסיים עריכת שיבוץ עם ${errorCount} שגיאות פתוחות`;
}

async function getOpenScheduleIssuesCount(scheduleId: string, courtId: string): Promise<number> {
  return prisma.scheduleWarning.count({
    where: {
      scheduleId,
      schedule: { courtId },
    },
  });
}

// = לסיים עריכת שיבוץ (בדיקת שגיאות בלבד — אין עוד סטטוס ביניים אחרי DRAFT)
export async function finalizeSchedule(scheduleId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  try {
    const schedule = await prisma.workSchedule.findFirst({
      where: { id: scheduleId, courtId },
      select: { id: true },
    });
    if (!schedule) return { error: 'השיבוץ לא נמצא' };

    const errorMessage = await getOpenErrorWarningsMessage(scheduleId, courtId);
    if (errorMessage) return { error: errorMessage };

    return { ok: true };
  } catch {
    return { error: 'שגיאה בסיום עריכת השיבוץ' };
  }
}
// = לפרסם שיבוץ
export async function publishSchedule(
  scheduleId: string,
  options: { confirmIssues?: boolean } = {},
): Promise<PublishScheduleResult> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  try {
    const draftVersion = await prisma.workScheduleVersion.findFirst({
      where: { scheduleId, courtId, status: ScheduleVersionStatus.DRAFT },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (!draftVersion) return { error: 'לא נמצאה גרסת טיוטה לפרסום' };

    const issueCount = await getOpenScheduleIssuesCount(scheduleId, courtId);
    if (issueCount > 0 && !options.confirmIssues) {
      return {
        requiresConfirmation: true,
        issueCount,
        message: `בשיבוץ קיימות ${issueCount} בעיות או אזהרות פתוחות. האם לפרסם בכל זאת?`,
      };
    }

    const assignments = await prisma.shiftAssignment.findMany({
      where: { versionId: draftVersion.id, courtId },
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
          courtId,
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
        where: { id: scheduleId, courtId },
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
