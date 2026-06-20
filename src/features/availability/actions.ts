'use server';

import { ScheduleStatus, ShiftType, SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { EmployeeAvailabilityForPeriod } from './types';

export async function getScheduleData() {
  const session = await requireSession(SystemRole.EMPLOYEE);
  const { courtId, employeeId } = session.user;

  if (!courtId || !employeeId) return { period: null, entries: {}, isSubmitted: false, note: '' };

  const period = await prisma.workSchedule.findFirst({
    where: { courtId, status: ScheduleStatus.OPEN },
  });

  if (!period) return { period: null, entries: {}, isSubmitted: false, note: '' };

  const submission = await prisma.availabilityForm.findUnique({
    where: { scheduleId_employeeId: { scheduleId: period.id, employeeId } },
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
      name: period.name,
      startDate: period.startDate.toISOString().slice(0, 10),
      endDate: period.endDate.toISOString().slice(0, 10),
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

  const period = await prisma.workSchedule.findFirst({
    where: { courtId, status: ScheduleStatus.OPEN },
  });
  if (!period) return { ok: false };

  const trimmedNote = note?.trim() || null;

  const submission = await prisma.availabilityForm.upsert({
    where: { scheduleId_employeeId: { scheduleId: period.id, employeeId } },
    update: { isSubmitted: true, submittedAt: new Date(), note: trimmedNote },
    create: {
      scheduleId: period.id,
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

export async function getEmployeeAvailability(employeeId: string): Promise<EmployeeAvailabilityForPeriod[]> {
  const rows = await prisma.availabilityForm.findMany({
    where: { employeeId },
    include: {
      schedule: true,
      shifts: true,
    },
    orderBy: { schedule: { startDate: 'desc' } },
  });
  return rows.map((row) => ({
    id: row.schedule.id,
    name: row.schedule.name,
    startDate: row.schedule.startDate.toISOString().slice(0, 10),
    endDate: row.schedule.endDate.toISOString().slice(0, 10),
    status: row.schedule.status,
    isSubmitted: row.isSubmitted,
    note: row.note ?? '',
    entries: row.shifts.map((s) => ({
      date: s.date,
      shiftType: s.shiftType,
      isAvailable: true,
    })),
  }));
}

export async function fetchMyEmployeeAvailability() {
  const session = await requireSession(SystemRole.EMPLOYEE);
  if (!session.user.employeeId) return [];
  return getEmployeeAvailability(session.user.employeeId);
}
