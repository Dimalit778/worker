'use server';

import { revalidatePath } from 'next/cache';
import { ScheduleStatus, ShiftType, SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { EmployeeAvailabilityForPeriod } from './types';

export async function getScheduleData() {
  const session = await requireSession(SystemRole.EMPLOYEE);
  const { courtId, employeeId } = session.user;

  if (!courtId || !employeeId) return { period: null, entries: {}, isSubmitted: false };

  const period = await prisma.schedule.findFirst({
    where: { courtId, status: ScheduleStatus.OPEN_FOR_SUBMISSION },
  });

  if (!period) return { period: null, entries: {}, isSubmitted: false };

  const submission = await prisma.availabilitySubmission.findUnique({
    where: { scheduleId_employeeId: { scheduleId: period.id, employeeId } },
    include: { slots: true },
  });

  const entries: Record<string, boolean> = {};
  for (const e of submission?.slots ?? []) {
    const iso = e.date.toISOString().slice(0, 10);
    entries[`${iso}-${e.shiftType}`] = e.isAvailable;
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
  };
}
// = להגיש שיבוץ משמרות
export async function submitAvailability(entries: Record<string, boolean>): Promise<{ ok: boolean }> {
  const session = await requireSession(SystemRole.EMPLOYEE);
  const { courtId, employeeId } = session.user;
  if (!courtId || !employeeId) return { ok: false };

  const period = await prisma.schedule.findFirst({
    where: { courtId, status: ScheduleStatus.OPEN_FOR_SUBMISSION },
  });
  if (!period) return { ok: false };

  const submission = await prisma.availabilitySubmission.upsert({
    where: { scheduleId_employeeId: { scheduleId: period.id, employeeId } },
    update: { isSubmitted: true, submittedAt: new Date() },
    create: {
      scheduleId: period.id,
      employeeId,
      isSubmitted: true,
      submittedAt: new Date(),
    },
  });

  // Replace all slots for this submission in one transaction
  const rows = Object.entries(entries)
    .filter(([, isAvailable]) => isAvailable)
    .map(([key]) => {
      const [year, month, day, shiftType] = key.split('-');
      return {
        submissionId: submission.id,
        date: new Date(`${year}-${month}-${day}T12:00:00Z`),
        shiftType: shiftType as ShiftType,
        isAvailable: true,
      };
    });

  await prisma.$transaction([
    prisma.availabilitySlot.deleteMany({ where: { submissionId: submission.id } }),
    ...(rows.length > 0 ? [prisma.availabilitySlot.createMany({ data: rows })] : []),
  ]);

  revalidatePath('/employee');
  return { ok: true };
}
export async function getEmployeeAvailability(employeeId: string): Promise<EmployeeAvailabilityForPeriod[]> {
  const rows = await prisma.availabilitySubmission.findMany({
    where: { employeeId },
    include: {
      schedule: true,
      slots: true,
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
    entries: row.slots.map((s) => ({
      date: s.date,
      shiftType: s.shiftType,
      isAvailable: s.isAvailable,
    })),
  }));
}


export async function fetchMyEmployeeAvailability() {
  const session = await requireSession(SystemRole.EMPLOYEE);
  if (!session.user.employeeId) return [];
  return getEmployeeAvailability(session.user.employeeId);
}
