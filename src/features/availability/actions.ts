'use server';

import { ScheduleStatus, ShiftType, SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireEmployee, requireSession } from '@/lib/db/auth-helpers';
import { EmployeeAvailabilityForPeriod } from './types';

export async function getScheduleData() {
  const session = await requireSession(SystemRole.EMPLOYEE);
  const { courtId, employeeId } = session.user;

  if (!courtId || !employeeId) return { period: null, entries: {}, isSubmitted: false, note: '' };

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, courtId, isActive: true, position: { code: { not: 1 } } },
    select: { id: true },
  });
  if (!employee) return { period: null, entries: {}, isSubmitted: false, note: '' };

  const period = await prisma.workSchedule.findFirst({
    where: { courtId, status: ScheduleStatus.OPEN },
    include: { period: true },
  });

  if (!period) return { period: null, entries: {}, isSubmitted: false, note: '' };

  const submission = await prisma.availabilityForm.findUnique({
    where: { periodId_employeeId: { periodId: period.periodId, employeeId } },
    include: { shifts: true },
  });

  const entries: Record<string, boolean> = {};
  for (const e of submission?.shifts ?? []) {
    const iso = e.date.toISOString().slice(0, 10);
    entries[`${iso}-${e.shiftType}`] = true;
  }

  return {
    period: {
      id: period.id,
      name: period.period.name,
      startDate: period.period.startDate.toISOString().slice(0, 10),
      endDate: period.period.endDate.toISOString().slice(0, 10),
      status: period.status,
    },
    entries,
    isSubmitted: submission?.isSubmitted ?? false,
    note: submission?.note ?? '',
  };
}

export async function submitAvailability(input: {
  entries: Record<string, boolean>;
  note?: string | null;
}): Promise<{ ok: boolean }> {
  const { entries, note } = input;
  const session = await requireSession(SystemRole.EMPLOYEE);
  const { courtId, employeeId } = session.user;
  if (!courtId || !employeeId) return { ok: false };

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, courtId, isActive: true, position: { code: { not: 1 } } },
    select: { id: true },
  });
  if (!employee) return { ok: false };

  const period = await prisma.workSchedule.findFirst({
    where: { courtId, status: ScheduleStatus.OPEN },
  });
  if (!period) return { ok: false };

  const trimmedNote = note?.trim() || null;

  const submission = await prisma.availabilityForm.upsert({
    where: { periodId_employeeId: { periodId: period.periodId, employeeId } },
    update: { isSubmitted: true, submittedAt: new Date(), note: trimmedNote },
    create: {
      periodId: period.periodId,
      employeeId,
      isSubmitted: true,
      submittedAt: new Date(),
      note: trimmedNote,
    },
  });

  const rows = Object.entries(entries)
    .filter(([, isAvailable]) => isAvailable)
    .map(([key]) => {
      const [year, month, day, shiftType] = key.split('-');
      return {
        formId: submission.id,
        date: new Date(`${year}-${month}-${day}T12:00:00Z`),
        shiftType: shiftType as ShiftType,
      };
    });

  await prisma.$transaction([
    prisma.availabilityShift.deleteMany({ where: { formId: submission.id } }),
    ...(rows.length > 0 ? [prisma.availabilityShift.createMany({ data: rows })] : []),
  ]);

  return { ok: true };
}

export async function getEmployeeAvailability(): Promise<EmployeeAvailabilityForPeriod[]> {
  const { courtId, employeeId } = await requireEmployee();
  if (!courtId || !employeeId) return [];
  const rows = await prisma.availabilityForm.findMany({
    where: { employeeId, period: { courtId }, employee: { position: { code: { not: 1 } } } },
    include: {
      period: { include: { schedule: { select: { status: true } } } },
      shifts: true,
    },
    orderBy: { period: { startDate: 'desc' } },
  });
  return rows.map((row) => ({
    id: row.period.id,
    name: row.period.name,
    startDate: row.period.startDate.toISOString().slice(0, 10),
    endDate: row.period.endDate.toISOString().slice(0, 10),
    status: row.period.schedule?.status ?? ScheduleStatus.ARCHIVED,
    isSubmitted: row.isSubmitted,
    note: row.note ?? '',
    entries: row.shifts.map((s) => ({
      date: s.date,
      shiftType: s.shiftType,
      isAvailable: true,
    })),
  }));
}

export const fetchMyEmployeeAvailability = getEmployeeAvailability;
