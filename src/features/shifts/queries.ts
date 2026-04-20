import { prisma } from '@/lib/db/client';
import { getCurrentSchedulingPeriod } from '@/features/schedules/actions';
import type { AssignmentMap, CapacityMap, FullCapacityRules, ShiftsPageData } from './types';
import { DayCategory, ShiftType } from '@/generated/prisma/client';

const DEFAULT_CAPACITY: CapacityMap = { MORNING: 15, EVENING: 6, NIGHT: 3 };
/** Friday: same as default but NIGHT is closed (0) */
const DEFAULT_FRIDAY: CapacityMap = { MORNING: 15, EVENING: 6, NIGHT: 0 };
/** Saturday: all shifts closed (0) by default */
const DEFAULT_SATURDAY: CapacityMap = { MORNING: 0, EVENING: 0, NIGHT: 0 };

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

export async function getFullCapacityRules(courtId: string): Promise<FullCapacityRules> {
  if (!courtId) {
    return { default: { ...DEFAULT_CAPACITY }, friday: { ...DEFAULT_FRIDAY }, saturday: { ...DEFAULT_SATURDAY } };
  }

  const rows = await prisma.courtShiftRule.findMany({
    where: { courtId },
    select: { shiftType: true, requiredCount: true, dayCategory: true },
  });

  function buildCapacityMap(category: DayCategory, defaults: CapacityMap): CapacityMap {
    const filtered = rows.filter((r) => r.dayCategory === category);
    // Sum requiredCount across all positions for each shiftType
    const sums: Partial<Record<ShiftType, number>> = {};
    for (const r of filtered) {
      sums[r.shiftType] = (sums[r.shiftType] ?? 0) + r.requiredCount;
    }
    const sumsList = (Object.entries(sums) as [ShiftType, number][]).map(([shiftType, maxStaff]) => ({
      shiftType,
      maxStaff,
    }));
    return mergeCapacityRules(sumsList, defaults);
  }

  return {
    default: buildCapacityMap(DayCategory.WEEKDAY, DEFAULT_CAPACITY),
    friday: buildCapacityMap(DayCategory.FRIDAY, DEFAULT_FRIDAY),
    saturday: buildCapacityMap(DayCategory.SATURDAY, DEFAULT_SATURDAY),
  };
}

export async function getShiftsPageData(
  courtId: string,
  options: { includeGuards?: boolean } = {},
): Promise<ShiftsPageData> {
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

  const capacity = await getFullCapacityRules(courtId);

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
