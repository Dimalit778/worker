import { prisma } from '@/lib/db/client';
import { getCurrentSchedulingPeriod } from '@/features/schedules/actions';
import type { AssignmentMap, CapacityMap, ShibutzPageData } from './types';

const DEFAULT_CAPACITY: CapacityMap = { MORNING: 15, EVENING: 6, NIGHT: 3 };

export function mergeCapacityRules(
  rules: { shiftType: 'MORNING' | 'EVENING' | 'NIGHT'; maxStaff: number }[],
  defaults: CapacityMap,
): CapacityMap {
  const result = { ...defaults };
  for (const rule of rules) {
    result[rule.shiftType] = rule.maxStaff;
  }
  return result;
}

export async function getCapacityRules(courtId: string): Promise<CapacityMap> {
  if (!courtId) return { ...DEFAULT_CAPACITY };
  const rows = await prisma.shiftCapacityRule.findMany({
    where: { courtId, dayOfWeek: null },
    select: { shiftType: true, maxStaff: true },
  });
  return mergeCapacityRules(rows, DEFAULT_CAPACITY);
}

export async function getShibutzPageData(
  courtId: string,
  options: { includeGuards?: boolean } = {},
): Promise<ShibutzPageData> {
  const periodRow = await getCurrentSchedulingPeriod();
  if (!periodRow) return { found: false };

  const scheduleRow = await prisma.schedule.findFirst({
    where: { periodId: periodRow.id },
    orderBy: { generatedAt: 'desc' },
  });

  const rawAssignments = scheduleRow
    ? await prisma.shiftAssignment.findMany({
        where: { scheduleId: scheduleRow.id },
        include: { employee: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const assignments: AssignmentMap = {};
  for (const a of rawAssignments) {
    const iso = a.date.toISOString().slice(0, 10);
    const key = `${iso}-${a.shiftType}`;
    if (!assignments[key]) assignments[key] = [];
    assignments[key].push({
      id: a.id,
      userId: a.employeeId,
      userName: a.employee.name,
      isOpeningDuty: a.isOpeningDuty,
    });
  }

  const guards =
    options.includeGuards && courtId
      ? await prisma.employee.findMany({
          where: { primaryCourtId: courtId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : [];

  const capacityRules = courtId ? await prisma.shiftCapacityRule.findMany({ where: { courtId } }) : [];

  const capacity: CapacityMap = mergeCapacityRules(
    capacityRules.filter((r) => r.dayOfWeek === null),
    DEFAULT_CAPACITY,
  );

  return {
    found: true,
    periodId: periodRow.id,
    periodName: periodRow.name,
    startDate: periodRow.startDate.toISOString().slice(0, 10),
    endDate: periodRow.endDate.toISOString().slice(0, 10),
    scheduleId: scheduleRow?.id ?? null,
    assignments,
    guards,
    capacity,
    courtId,
  };
}
