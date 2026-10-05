'use server';
import { periodScheduleStatus, PeriodScheduleStatus } from '@/features/schedules/period-status';
import { Prisma, type AvailabilityPreference, type ShiftType } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireEmployee } from '@/lib/db/auth-helpers';
import type { EmployeeAvailabilityForPeriod } from './types';

export async function getScheduleData() {
  const { facilityId, employeeId } = await requireEmployee();
  const now = new Date();
  const schedule = await prisma.schedule.findFirst({
    where: {
      facilityId,
      status: 'DRAFT',
      submissionOpensAt: { lte: now },
      submissionClosesAt: { gt: now },
    },
    orderBy: { startDate: 'asc' },
  });
  const empty = { period: null, entries: {} as Record<string, AvailabilityPreference>, isSubmitted: false, note: '' };
  if (!schedule) return empty;
  const form = await prisma.availabilitySubmission.findUnique({
    where: { scheduleId_userId: { scheduleId: schedule.id, userId: employeeId } },
    include: { availabilities: true },
  });
  return {
    period: {
      id: schedule.id,
      name: schedule.name,
      startDate: schedule.startDate.toISOString().slice(0, 10),
      endDate: schedule.endDate.toISOString().slice(0, 10),
      status: PeriodScheduleStatus.OPEN,
    },
    entries: Object.fromEntries(
      (form?.availabilities ?? []).map((s) => [`${s.date.toISOString().slice(0, 10)}-${s.shiftType}`, s.preference]),
    ),
    isSubmitted: form?.submittedAt != null,
    note: form?.note ?? '',
  };
}

export async function submitAvailability(input: {
  periodId: string;
  entries: Record<string, AvailabilityPreference | boolean>;
  note?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { facilityId, employeeId } = await requireEmployee();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Facility" WHERE id=${facilityId} FOR UPDATE`;
        const employee = await tx.user.findFirst({ where: { id: employeeId, facilityId } });
        const schedule = await tx.schedule.findFirst({ where: { id: input.periodId, facilityId } });
        const now = new Date();
        if (
          !employee ||
          !schedule ||
          schedule.status !== 'DRAFT' ||
          now < schedule.submissionOpensAt ||
          now >= schedule.submissionClosesAt
        )
          throw new Error('חלון ההגשות סגור');
        const rows = Object.entries(input.entries).map(([key, raw]) => {
          const match = /^(\d{4}-\d{2}-\d{2})-(MORNING|EVENING|NIGHT)$/.exec(key);
          if (!match) throw new Error('משמרת לא תקינה');
          const date = new Date(`${match[1]}T00:00:00Z`);
          const preference = raw === true ? 'AVAILABLE' : raw === false ? 'UNAVAILABLE' : raw;
          if (
            !['AVAILABLE', 'PREFERRED', 'UNAVAILABLE'].includes(preference) ||
            !Number.isFinite(date.getTime()) ||
            date.toISOString().slice(0, 10) !== match[1] ||
            date < schedule.startDate ||
            date > schedule.endDate
          )
            throw new Error('זמינות או תאריך אינם תקינים');
          return { date, shiftType: match[2] as ShiftType, preference: preference as AvailabilityPreference };
        });
        const form = await tx.availabilitySubmission.upsert({
          where: { scheduleId_userId: { scheduleId: schedule.id, userId: employeeId } },
          create: {
            scheduleId: schedule.id,
            userId: employeeId,
            facilityId,
            submittedAt: now,
            note: input.note?.trim() || null,
          },
          update: { submittedAt: now, note: input.note?.trim() || null },
        });
        await tx.shiftAvailability.deleteMany({ where: { submissionId: form.id } });
        if (rows.length)
          await tx.shiftAvailability.createMany({ data: rows.map((row) => ({ ...row, submissionId: form.id })) });
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'שמירת הגשה נכשלה' };
  }
}

export async function getEmployeeAvailability(): Promise<EmployeeAvailabilityForPeriod[]> {
  const { facilityId, employeeId } = await requireEmployee();
  const rows = await prisma.availabilitySubmission.findMany({
    where: { userId: employeeId, schedule: { facilityId } },
    include: { schedule: true, availabilities: true },
    orderBy: { schedule: { startDate: 'desc' } },
  });
  return rows.map((row) => ({
    id: row.schedule.id,
    name: row.schedule.name,
    startDate: row.schedule.startDate.toISOString().slice(0, 10),
    endDate: row.schedule.endDate.toISOString().slice(0, 10),
    status: periodScheduleStatus(row.schedule),
    isSubmitted: row.submittedAt != null,
    note: row.note ?? '',
    entries: row.availabilities.map((s) => ({
      date: s.date,
      shiftType: s.shiftType,
      isAvailable: s.preference !== 'UNAVAILABLE',
      preference: s.preference,
    })),
  }));
}
export const fetchMyEmployeeAvailability = getEmployeeAvailability;
