'use server';
import { periodScheduleStatus, type PeriodScheduleStatus } from '@/features/schedules/period-status';
import { PortalRole } from '@/lib/auth/portal';
import { prisma } from '@/lib/db/client';
import { Prisma } from '@/generated/prisma/client';
import { scheduleTransaction } from '@/features/schedules/services/transactions';
import { requireSession } from '@/lib/db/auth-helpers';
import { PeriodSummary } from './types';
import { formatDate, parseISODateToUtcMidnight } from './utils';
import {
  isInWeekBefore,
  jerusalemWeekdayAndTime,
  parseJerusalemLocal,
  periodStartInstant,
  ruleOrderError,
} from './submission-window';
import { processDueSubmissionWindows } from './process-windows';

export async function getSchedulesList(): Promise<PeriodSummary[]> {
  const session = await requireSession(PortalRole.MANAGER);

  const periods = await prisma.roster.findMany({
    where: {
      facilityId: session.user.facilityId ?? '',
    },
    orderBy: { period: { startDate: 'desc' } },
    include: {
      versions: { select: { status: true, isActive: true } },
      period: {
        include: {
          _count: {
            select: {
              availabilitySubmissions: { where: { isSubmitted: true, employee: { primaryShiftRole: { code: { not: 1 } } } } },
            },
          },
        },
      },
    },
  });

  const totalEmployees = await prisma.employee.count({
    where: { facilityId: session.user.facilityId ?? '', isActive: true, primaryShiftRole: { code: { not: 1 } } },
  });

  return periods.map((p) => ({
    id: p.id,
    name: p.period.name,
    startDate: p.period.startDate.toISOString().slice(0, 10),
    endDate: p.period.endDate.toISOString().slice(0, 10),
    submissionDeadline: p.period.submissionDeadline.toISOString(),
    status: periodScheduleStatus({
      archivedAt: p.archivedAt,
      submissionState: p.period.submissionState,
      versions: p.versions,
    }),
    submittedCount: p.period._count.availabilitySubmissions ?? 0,
    totalEmployees: totalEmployees ?? 0,
  }));
}

export async function createSchedule(data: {
  name: string;
  startDate: string;
  endDate: string;
  submissionOpensAt: string;
  submissionDeadline: string;
  saveAsStandingRule?: boolean;
}): Promise<{ ok: true; id: string; emailWarning?: string } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);

  if (!data.name.trim()) return { error: 'שם השיבוץ חובה' };
  if (!data.startDate || !data.endDate || !data.submissionOpensAt || !data.submissionDeadline) {
    return { error: 'כל השדות חובה' };
  }
  if (!session.user.facilityId) return { error: 'למנהל אין בית משפט משויך' };
  if (!session.user.id) return { error: 'למנהל אין משתמש משויך' };

  const start = parseISODateToUtcMidnight(data.startDate);
  const end = parseISODateToUtcMidnight(data.endDate);
  if (end <= start) return { error: 'תאריך סיום חייב להיות אחרי תאריך התחלה' };

  const opensAt = parseJerusalemLocal(data.submissionOpensAt);
  const deadline = parseJerusalemLocal(data.submissionDeadline);
  if (!opensAt || !deadline) return { error: 'מועדי ההגשה לא תקינים' };
  if (opensAt.getTime() >= deadline.getTime()) return { error: 'מועד הפתיחה חייב להיות לפני מועד הסגירה' };
  if (deadline.getTime() >= periodStartInstant(data.startDate).getTime()) {
    return { error: 'מועד ההגשה חייב להיות לפני תחילת התקופה' };
  }
  if (opensAt.getTime() < Date.now() - 60_000) return { error: 'מועד השליחה כבר עבר' };
  if (deadline.getTime() < Date.now()) return { error: 'מועד ההגשה כבר עבר' };

  const standingRule = data.saveAsStandingRule
    ? {
        open: jerusalemWeekdayAndTime(opensAt),
        close: jerusalemWeekdayAndTime(deadline),
      }
    : null;
  if (standingRule) {
    if (!isInWeekBefore(data.startDate, opensAt) || !isInWeekBefore(data.startDate, deadline)) {
      return { error: 'אפשר לשמור כלל קבוע רק ממועדים בשבוע שלפני התקופה' };
    }
    const ruleError = ruleOrderError({
      openWeekday: standingRule.open.weekday,
      openTime: standingRule.open.time,
      closeWeekday: standingRule.close.weekday,
      closeTime: standingRule.close.time,
    });
    if (ruleError) return { error: ruleError };
  }

  try {
    const schedule = await scheduleTransaction({ userId: session.user.id, facilityId: session.user.facilityId! }, async (tx) => {
      const overlapping = await tx.schedulePeriod.findFirst({
        where: {
          facilityId: session.user.facilityId ?? '',
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });

      if (overlapping) {
        const overlapStart = formatDate(overlapping.startDate.toISOString().slice(0, 10));
        const overlapEnd = formatDate(overlapping.endDate.toISOString().slice(0, 10));
        throw new Error(`התקופה חופפת לתקופה קיימת: ${overlapping.name} (${overlapStart}–${overlapEnd})`);
      }

      if (standingRule) {
        await tx.facility.update({
          where: { id: session.user.facilityId ?? '' },
          data: {
            submissionOpenWeekday: standingRule.open.weekday,
            submissionOpenTime: standingRule.open.time,
            submissionCloseWeekday: standingRule.close.weekday,
            submissionCloseTime: standingRule.close.time,
          },
        });
      }

      const period = await tx.schedulePeriod.create({
        data: {
          name: data.name.trim(),
          startDate: start,
          endDate: end,
          submissionOpensAt: opensAt,
          submissionDeadline: deadline,
          submissionWindowManaged: true,
          facilityId: session.user.facilityId ?? '',
        },
      });

      return tx.roster.create({
        data: {
          id: period.id,
          periodId: period.id,
          facilityId: session.user.facilityId ?? '',
          createdById: session.user.id,
        },
      });
    });

    const processed = await processDueSubmissionWindows(session.user.facilityId);
    const emailWarning = processed.emailErrors[schedule.periodId];
    return {
      ok: true,
      id: schedule.id,
      emailWarning: emailWarning ? `התקופה נוצרה, אבל האימייל לא נשלח. ${emailWarning}` : undefined,
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: 'שיבוץ זה כבר קיים' };
    }
    if (e instanceof Error && e.message.startsWith('התקופה חופפת')) {
      return { error: e.message };
    }
    return { error: 'שגיאה ביצירת השיבוץ' };
  }
}

export async function deleteSchedule(scheduleId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);

  try {
    await scheduleTransaction({ userId: session.user.id, facilityId: session.user.facilityId! }, async tx => {
      const schedule = await tx.roster.findFirst({ where: { id: scheduleId, facilityId: session.user.facilityId! }, include: { versions: true, _count: { select: { changeLogs: true } } } });
      if (!schedule) throw new Error('השיבוץ לא נמצא');
      if (schedule.versions.some(v => v.publishedAt) || schedule._count.changeLogs) {
        await tx.roster.update({ where: { id: scheduleId }, data: { archivedAt: new Date() } });
        await tx.schedulePeriod.update({ where: { id: schedule.periodId }, data: { submissionState: 'CLOSED' } });
        await tx.scheduleChangeLog.create({ data: { scheduleId, changedById: session.user.id, changeType: 'UPDATE', message: 'השיבוץ הועבר לארכיון', beforeData: { archivedAt: schedule.archivedAt }, afterData: { status: 'ARCHIVED' } } });
      } else {
        await tx.schedulePeriod.delete({ where: { id: schedule.periodId } });
      }
    });
    return { ok: true };
  } catch {
    return { error: 'שגיאה במחיקת השיבוץ' };
  }
}

export async function updateScheduleStatus(
  scheduleId: string,
  status: PeriodScheduleStatus,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(PortalRole.MANAGER);

  try {
    if (!['OPEN','LOCKED','ARCHIVED'].includes(status)) return { error: 'מעבר סטטוס לא מותר; פרסום מתבצע מתוך טיוטה' };
    await scheduleTransaction({ userId: session.user.id, facilityId: session.user.facilityId! }, async tx => {
      const schedule = await tx.roster.findFirst({
        where: { id: scheduleId, facilityId: session.user.facilityId! },
        include: { period: true, versions: { select: { status: true, isActive: true } } },
      });
      const current = schedule
        ? periodScheduleStatus({ archivedAt: schedule.archivedAt, submissionState: schedule.period.submissionState, versions: schedule.versions })
        : null;
      if (!schedule || current === 'ARCHIVED' || (current === 'PUBLISHED' && status !== 'ARCHIVED')) throw new Error('מעבר סטטוס לא מותר');
      const now = new Date();
      if (status === 'OPEN' && (now < schedule.period.submissionOpensAt || now >= schedule.period.submissionDeadline)) throw new Error('מחוץ לחלון ההגשות');
      await tx.schedulePeriod.update({ where: { id: schedule.periodId }, data: { submissionState: status === 'OPEN' ? 'OPEN' : 'CLOSED' } });
      if (status === 'ARCHIVED') await tx.roster.update({ where: { id: scheduleId }, data: { archivedAt: now } });
      await tx.scheduleChangeLog.create({ data: { scheduleId, changedById: session.user.id, changeType: 'UPDATE', message: 'עודכן מצב התקופה', beforeData: { status: current }, afterData: { status } } });
    });

    return { ok: true };
  } catch {
    return { error: 'שגיאה בעדכון הסטטוס' };
  }
}
