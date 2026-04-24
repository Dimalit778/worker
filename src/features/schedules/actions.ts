'use server';
import { prisma } from '@/lib/db/client';
import { PeriodStatus, PrismaClient, ScheduleStatus } from '@/generated/prisma/client';
import { DEFAULT_TZ } from './utils';
import { utcNoonFromCalendarISO } from './utils';
import { calendarDateISO } from './utils';
import { SchedulingPeriod } from '@/generated/prisma/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { PeriodSummary } from './types';
import { parseISODateToUtcMidnight } from './utils';
import { revalidatePath } from 'next/cache';
// = מוציא תקופה פתוחה
export async function getOpenPeriod(courtId: string): Promise<SchedulingPeriod | null> {
  return prisma.schedulingPeriod.findFirst({ where: { courtId, status: PeriodStatus.OPEN_FOR_SUBMISSION } });
}
// = מוציא רשימת תקופות למנהל
export async function getPeriodsForManager(): Promise<PeriodSummary[]> {
  await requireSession(SystemRole.MANAGER);

  const periods = await prisma.schedulingPeriod.findMany({
    orderBy: { startDate: 'desc' },
    include: {
      _count: {
        select: {
          availabilities: { where: { isSubmitted: true } },
        },
      },
    },
  });

  const totalGuards = await prisma.employee.count({
    where: { isActive: true },
  });

  return periods.map((p) => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate.toISOString().slice(0, 10),
    endDate: p.endDate.toISOString().slice(0, 10),
    submissionDeadline: p.submissionDeadline.toISOString(),
    status: p.status,
    submittedCount: p._count.availabilities,
    totalGuards,
  }));
}
// = ליצור תקופה חדשה
export async function createPeriod(data: {
  name: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);

  if (!data.name.trim()) return { error: 'שם התקופה חובה' };
  if (!data.startDate || !data.endDate || !data.submissionDeadline) return { error: 'כל השדות חובה' };
  if (!session.user.courtId) return { error: 'למנהל אין בית משפט משויך' };
  if (!session.user.id) return { error: 'למנהל אין משתמש משויך' };

  const start = parseISODateToUtcMidnight(data.startDate);
  const end = parseISODateToUtcMidnight(data.endDate);
  if (end <= start) return { error: 'תאריך סיום חייב להיות אחרי תאריך התחלה' };

  const deadline = new Date(data.submissionDeadline);
  if (isNaN(deadline.getTime())) return { error: 'מועד אחרון להגשה לא תקין' };

  try {
    const period = await prisma.schedulingPeriod.create({
      data: {
        name: data.name.trim(),
        startDate: start,
        endDate: end,
        submissionDeadline: deadline,
        status: PeriodStatus.OPEN_FOR_SUBMISSION,
        courtId: session.user.courtId,
        createdById: session.user.id,
      },
    });

    revalidatePath('/manager/periods');
    revalidatePath('/manager');
    return { ok: true, id: period.id };
  } catch {
    return { error: 'שגיאה ביצירת התקופה' };
  }
}
// = למחוק תקופה
export async function deletePeriod(periodId: string): Promise<{ ok: true } | { error: string }> {
  await requireSession(SystemRole.MANAGER);

  try {
    await prisma.schedulingPeriod.delete({ where: { id: periodId } });
    revalidatePath('/manager/periods');
    revalidatePath('/manager');
    return { ok: true };
  } catch {
    return { error: 'שגיאה במחיקת התקופה' };
  }
}
// = לעדכן סטטוס תקופה
export async function updatePeriodStatus(
  periodId: string,
  status: PeriodStatus,
): Promise<{ ok: true } | { error: string }> {
  await requireSession(SystemRole.MANAGER);

  try {
    await prisma.schedulingPeriod.update({
      where: { id: periodId },
      data: { status },
    });

    revalidatePath('/manager/periods');
    revalidatePath('/manager');
    revalidatePath('/user/schedule');
    return { ok: true };
  } catch {
    return { error: 'שגיאה בעדכון הסטטוס' };
  }
}
// = ליצור שיבוץ חדש
export async function createSchedule(periodId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  await requireSession(SystemRole.MANAGER);

  try {
    await prisma.schedule.create({ data: { periodId, generatedById: session.user.id } });
    return { ok: true };
  } catch {
    return { error: 'שגיאה ביצירת השיבוץ' };
  }
}
// = לסיים עריכת שיבוץ
export async function finalizeSchedule(scheduleId: string): Promise<{ ok: true } | { error: string }> {
  await requireSession(SystemRole.MANAGER);

  try {
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
