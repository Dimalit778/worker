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
import { saveSubmissionWindowSetting } from '@/features/settings/queries';

export async function getSchedulesList(): Promise<PeriodSummary[]> {
  const session = await requireSession(PortalRole.MANAGER);

  const periods = await prisma.schedule.findMany({
    where: {
      facilityId: session.user.facilityId ?? '',
    },
    orderBy: { startDate: 'desc' },
    include: {
      _count: {
        select: {
          submissions: { where: { submittedAt: { not: null }, user: { role: { rank: { not: 1 } } } } },
        },
      },
    },
  });

  const totalEmployees = await prisma.user.count({
    where: { facilityId: session.user.facilityId ?? '', role: { rank: { not: 1 } } },
  });

  return periods.map((p) => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate.toISOString().slice(0, 10),
    endDate: p.endDate.toISOString().slice(0, 10),
    submissionDeadline: p.submissionClosesAt.toISOString(),
    status: periodScheduleStatus(p),
    submittedCount: p._count.submissions ?? 0,
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
      const overlapping = await tx.schedule.findFirst({
        where: {
          facilityId: session.user.facilityId ?? '',
          startDate: { lte: end },
          endDate: { gte: start },
          status: { not: 'ARCHIVED' },
        },
      });

      if (overlapping) {
        const overlapStart = formatDate(overlapping.startDate.toISOString().slice(0, 10));
        const overlapEnd = formatDate(overlapping.endDate.toISOString().slice(0, 10));
        throw new Error(`התקופה חופפת לתקופה קיימת: ${overlapping.name} (${overlapStart}–${overlapEnd})`);
      }

      if (standingRule) {
        await saveSubmissionWindowSetting(session.user.facilityId ?? '', {
          openWeekday: standingRule.open.weekday,
          openTime: standingRule.open.time,
          closeWeekday: standingRule.close.weekday,
          closeTime: standingRule.close.time,
        });
      }

      const created = await tx.schedule.create({
        data: {
          name: data.name.trim(),
          startDate: start,
          endDate: end,
          submissionOpensAt: opensAt,
          submissionClosesAt: deadline,
          facilityId: session.user.facilityId ?? '',
        },
      });
      const version = await tx.scheduleVersion.create({ data: { scheduleId: created.id, facilityId: created.facilityId, number: 1 } });
      return tx.schedule.update({ where: { id: created.id }, data: { draftVersionId: version.id } });
    });

    const processed = await processDueSubmissionWindows(session.user.facilityId);
    const emailWarning = processed.emailErrors[schedule.id];
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
      const schedule = await tx.schedule.findFirst({ where: { id: scheduleId, facilityId: session.user.facilityId! }, include: { _count: { select: { changes: true, slots: true } } } });
      if (!schedule) throw new Error('השיבוץ לא נמצא');
      if (schedule.publishedAt || schedule.draftVersionId || schedule._count.changes || schedule._count.slots) {
        await tx.schedule.update({ where: { id: scheduleId }, data: { status: 'ARCHIVED' } });
        await tx.scheduleChange.create({ data: { facilityId: session.user.facilityId!, scheduleId, changedById: session.user.id, changeType: 'ARCHIVE', reason: 'השיבוץ הועבר לארכיון', beforeData: { status: schedule.status }, afterData: { status: 'ARCHIVED' } } });
      } else {
        await tx.schedule.delete({ where: { id: scheduleId } });
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
      const schedule = await tx.schedule.findFirst({
        where: { id: scheduleId, facilityId: session.user.facilityId! },
      });
      const current = schedule ? periodScheduleStatus(schedule) : null;
      if (!schedule || current === 'ARCHIVED' || (current === 'PUBLISHED' && status !== 'ARCHIVED')) throw new Error('מעבר סטטוס לא מותר');
      const now = new Date();
      if (status === 'OPEN' && (now < schedule.submissionOpensAt || now >= schedule.submissionClosesAt)) throw new Error('מחוץ לחלון ההגשות');
      if (status === 'ARCHIVED') {
        await tx.schedule.update({ where: { id: scheduleId }, data: { status: 'ARCHIVED' } });
      } else if (status === 'LOCKED' && schedule.submissionClosesAt > now) {
        await tx.schedule.update({ where: { id: scheduleId }, data: { submissionClosesAt: now } });
      }
      await tx.scheduleChange.create({ data: { facilityId: session.user.facilityId!, scheduleId, changedById: session.user.id, changeType: status === 'ARCHIVED' ? 'ARCHIVE' : 'UPDATE', reason: 'עודכן מצב התקופה', beforeData: { status: current }, afterData: { status } } });
    });

    return { ok: true };
  } catch {
    return { error: 'שגיאה בעדכון הסטטוס' };
  }
}
