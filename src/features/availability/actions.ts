'use server';
import { periodScheduleStatus, PeriodScheduleStatus } from '@/features/schedules/period-status';
import { Prisma, type AvailabilityPreference, type ShiftType } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireEmployee } from '@/lib/db/auth-helpers';
import type { EmployeeAvailabilityForPeriod } from './types';

export async function getScheduleData() {
  const { facilityId, employeeId } = await requireEmployee();
  const now = new Date();
  const period = await prisma.schedulePeriod.findFirst({
    where: { facilityId, submissionState: { not: 'CLOSED' }, submissionOpensAt: { lte: now }, submissionDeadline: { gt: now }, schedule: { is: { archivedAt: null, versions: { none: { status: 'PUBLISHED', isActive: true } } } } },
    orderBy: { startDate: 'asc' }, include: { schedule: true },
  });
  const empty = { period: null, entries: {} as Record<string, AvailabilityPreference>, isSubmitted: false, note: '' };
  if (!period) return empty;
  const form = await prisma.availabilitySubmission.findUnique({ where: { periodId_employeeId: { periodId: period.id, employeeId } }, include: { shiftAvailabilities: true } });
  return {
    period: { id: period.id, name: period.name, startDate: period.startDate.toISOString().slice(0,10), endDate: period.endDate.toISOString().slice(0,10), status: PeriodScheduleStatus.OPEN },
    entries: Object.fromEntries((form?.shiftAvailabilities ?? []).map(s => [`${s.date.toISOString().slice(0,10)}-${s.shiftType}`, s.preference])),
    isSubmitted: form?.isSubmitted ?? false, note: form?.note ?? '',
  };
}

export async function submitAvailability(input: { periodId: string; entries: Record<string, AvailabilityPreference | boolean>; note?: string | null }): Promise<{ ok: boolean; error?: string }> {
  const { facilityId, employeeId } = await requireEmployee();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Facility" WHERE id=${facilityId} FOR UPDATE`;
      const employee = await tx.employee.findFirst({ where: { id: employeeId, facilityId, isActive: true } });
      const period = await tx.schedulePeriod.findFirst({ where: { id: input.periodId, facilityId }, include: { schedule: { include: { versions: { select: { status: true, isActive: true } } } } } });
      const now = new Date();
      const published = period?.schedule?.versions.some((version) => version.status === 'PUBLISHED' && version.isActive);
      if (!employee || !period || period.submissionState === 'CLOSED' || now < period.submissionOpensAt || now >= period.submissionDeadline || period.schedule?.archivedAt || published) throw new Error('חלון ההגשות סגור');
      const rows = Object.entries(input.entries).map(([key, raw]) => {
        const match = /^(\d{4}-\d{2}-\d{2})-(MORNING|EVENING|NIGHT)$/.exec(key);
        if (!match) throw new Error('משמרת לא תקינה');
        const date = new Date(`${match[1]}T00:00:00Z`);
        const preference = raw === true ? 'AVAILABLE' : raw === false ? 'UNAVAILABLE' : raw;
        if (!['AVAILABLE','PREFERRED','UNAVAILABLE'].includes(preference) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== match[1] || date < period.startDate || date > period.endDate) throw new Error('זמינות או תאריך אינם תקינים');
        return { date, shiftType: match[2] as ShiftType, preference: preference as AvailabilityPreference };
      });
      const form = await tx.availabilitySubmission.upsert({ where: { periodId_employeeId: { periodId: period.id, employeeId } }, create: { periodId: period.id, employeeId, isSubmitted: true, submittedAt: now, note: input.note?.trim() || null }, update: { isSubmitted: true, submittedAt: now, note: input.note?.trim() || null } });
      await tx.shiftAvailability.deleteMany({ where: { submissionId: form.id } });
      if (rows.length) await tx.shiftAvailability.createMany({ data: rows.map(row => ({ ...row, submissionId: form.id })) });
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'שמירת הגשה נכשלה' }; }
}

export async function getEmployeeAvailability(): Promise<EmployeeAvailabilityForPeriod[]> {
  const { facilityId, employeeId } = await requireEmployee();
  const rows = await prisma.availabilitySubmission.findMany({ where: { employeeId, period: { facilityId } }, include: { period: { include: { schedule: { include: { versions: { select: { status: true, isActive: true } } } } } }, shiftAvailabilities: true }, orderBy: { period: { startDate: 'desc' } } });
  return rows.map(row => ({ id: row.period.id, name: row.period.name, startDate: row.period.startDate.toISOString().slice(0,10), endDate: row.period.endDate.toISOString().slice(0,10), status: row.period.schedule ? periodScheduleStatus({ archivedAt: row.period.schedule.archivedAt, submissionState: row.period.submissionState, versions: row.period.schedule.versions }) : PeriodScheduleStatus.ARCHIVED, isSubmitted: row.isSubmitted, note: row.note ?? '', entries: row.shiftAvailabilities.map(s => ({ date: s.date, shiftType: s.shiftType, isAvailable: s.preference !== 'UNAVAILABLE', preference: s.preference })) }));
}
export const fetchMyEmployeeAvailability = getEmployeeAvailability;
