'use server';

import { revalidatePath } from 'next/cache';
import { PeriodStatus, ShiftType, SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/db/auth-helpers';
import { getOpenPeriod } from '../schedules/actions';

async function getEmployeeForUser(userId: string) {
  return prisma.employee.findFirst({
    where: { user: { id: userId } },
    select: { id: true, courtId: true },
  });
}

export async function getScheduleData() {
  const session = await requireSession(SystemRole.EMPLOYEE);
  const employee = await getEmployeeForUser(session.user.id);
  if (!employee) return { period: null, entries: {}, isSubmitted: false };

  const period = await prisma.schedulePeriod.findFirst({
    where: { courtId: employee.courtId, status: PeriodStatus.OPEN_FOR_SUBMISSION },
  });

  console.log('period -->', JSON.stringify(period, null, 2));
  if (!period) return { period: null, entries: {}, isSubmitted: false };

  const availability = await prisma.availability.findUnique({
    where: { periodId_employeeId: { periodId: period.id, employeeId: employee.id } },
    include: { entries: true },
  });

  const entries: Record<string, boolean> = {};
  for (const e of availability?.entries ?? []) {
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
    isSubmitted: availability?.isSubmitted ?? false,
  };
}
// = להגיש שיבוץ משמרות
export async function submitAvailability(entries: Record<string, boolean>): Promise<{ ok: boolean }> {
  const session = await requireSession(SystemRole.EMPLOYEE);
  const employee = await getEmployeeForUser(session.user.id);
  if (!employee?.courtId) return { ok: false };

  const period = await getOpenPeriod(employee.courtId);
  if (!period) return { ok: false };

  const availability = await prisma.availability.upsert({
    where: { periodId_employeeId: { periodId: period.id, employeeId: employee.id } },
    update: { isSubmitted: true, submittedAt: new Date() },
    create: {
      periodId: period.id,
      employeeId: employee.id,
      isSubmitted: true,
      submittedAt: new Date(),
    },
  });

  // Replace all entries for this availability in one transaction
  const rows = Object.entries(entries)
    .filter(([, isAvailable]) => isAvailable)
    .map(([key]) => {
      const [year, month, day, shiftType] = key.split('-');
      return {
        availabilityId: availability.id,
        date: new Date(`${year}-${month}-${day}T12:00:00Z`),
        shiftType: shiftType as ShiftType,
        isAvailable: true,
      };
    });

  await prisma.$transaction([
    prisma.availabilityEntry.deleteMany({ where: { availabilityId: availability.id } }),
    ...(rows.length > 0 ? [prisma.availabilityEntry.createMany({ data: rows })] : []),
  ]);

  revalidatePath('/user/schedule');
  return { ok: true };
}
