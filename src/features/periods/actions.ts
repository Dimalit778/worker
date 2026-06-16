'use server';
import { prisma } from '@/lib/db/client';
import { ScheduleStatus, Prisma, SystemRole } from '@/generated/prisma/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { PeriodSummary } from './types';
import { parseISODateToUtcMidnight } from './utils';
import { revalidatePath } from 'next/cache';

// = מוצא רשימת שיבוצים למנהל
export async function getSchedulesList(): Promise<PeriodSummary[]> {
  const session = await requireSession(SystemRole.MANAGER);

  const periods = await prisma.schedule.findMany({
    where: {
      courtId: session.user.courtId,
    },
    orderBy: { startDate: 'desc' },
    include: {
      _count: {
        select: {
          availabilitySubmissions: { where: { isSubmitted: true } },
        },
      },
    },
  });

  const totalEmployees = await prisma.employee.count({
    where: { isActive: true },
  });

  return periods.map((p) => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate.toISOString().slice(0, 10),
    endDate: p.endDate.toISOString().slice(0, 10),
    submissionDeadline: p.submissionDeadline.toISOString(),
    status: p.status,
    submittedCount: p._count.availabilitySubmissions ?? 0,
    totalEmployees: totalEmployees ?? 0,
  }));
}

// = ליצור תקופה חדשה
export async function createSchedule(data: {
  name: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);

  if (!data.name.trim()) return { error: 'שם השיבוץ חובה' };
  if (!data.startDate || !data.endDate || !data.submissionDeadline) return { error: 'כל השדות חובה' };
  if (!session.user.courtId) return { error: 'למנהל אין בית משפט משויך' };
  if (!session.user.id) return { error: 'למנהל אין משתמש משויך' };

  const start = parseISODateToUtcMidnight(data.startDate);
  const end = parseISODateToUtcMidnight(data.endDate);
  if (end <= start) return { error: 'תאריך סיום חייב להיות אחרי תאריך התחלה' };

  const deadline = new Date(data.submissionDeadline);
  if (isNaN(deadline.getTime())) return { error: 'מועד אחרון להגשה לא תקין' };

  try {
    const schedule = await prisma.schedule.create({
      data: {
        name: data.name.trim(),
        startDate: start,
        endDate: end,
        submissionDeadline: deadline,
        status: ScheduleStatus.OPEN_FOR_SUBMISSION,
        courtId: session.user.courtId,
        createdById: session.user.id,
      },
    });

    revalidatePath('/manager/periods');
    revalidatePath('/manager');
    return { ok: true, id: schedule.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return {
        error: 'כבר קיים שיבוץ עם אותם תאריכי התחלה וסיום עבור בית המשפט. מחקו או שינו את השיבוץ הקיים.',
      };
    }
    return { error: 'שגיאה ביצירת השיבוץ' };
  }
}
// = למחוק תקופה
export async function deleteSchedule(scheduleId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);

  try {
    await prisma.schedule.delete({ where: { id: scheduleId, courtId: session.user.courtId } });
    revalidatePath('/manager/periods');
    revalidatePath('/manager');
    return { ok: true };
  } catch {
    return { error: 'שגיאה במחיקת השיבוץ' };
  }
}

// = לעדכן סטטוס תקופה
export async function updateScheduleStatus(
  scheduleId: string,
  status: ScheduleStatus,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);

  try {
    await prisma.schedule.update({
      where: { id: scheduleId, courtId: session.user.courtId },
      data: { status },
    });

    revalidatePath('/manager/periods');
    revalidatePath('/manager');
    revalidatePath('/employee');
    return { ok: true };
  } catch {
    return { error: 'שגיאה בעדכון הסטטוס' };
  }
}
