import { prisma } from '@/lib/db/client';
import { getOpenPeriod } from '@/features/schedules/actions';
import type {
  AssignmentMap,
  CapacityMap,
  CourtShiftRuleRow,
  DraftScheduleData,
  FullCapacityRules,
  ShiftsPageData,
} from './types';
import { DayCategory, PeriodStatus, ShiftType } from '@/generated/prisma/client';

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

// = למצוא שיבוץ בהכנה
export async function getDraftScheduleData(courtId: string): Promise<DraftScheduleData> {
  const periodRow = await prisma.schedulingPeriod.findFirst({
    where: { courtId, status: PeriodStatus.LOCKED },
    orderBy: { startDate: 'desc' },
  });
  if (!periodRow) return { found: false };

  const scheduleRow = await prisma.schedule.findFirst({
    where: { periodId: periodRow.id },
  });

  const rawAssignments = scheduleRow
    ? await prisma.shiftAssignment.findMany({
        where: { scheduleId: scheduleRow.id },
        include: { employee: { select: { firstName: true, lastName: true } } },
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
      userName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
      isOpeningDuty: a.isOpeningDuty,
    });
  }

  const guards = await prisma.employee.findMany({
    where: { courtId, isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });

  const capacity = await getFullCapacityRules(courtId);

  return {
    found: true,
    periodId: periodRow.id,
    periodName: periodRow.name,
    startDate: periodRow.startDate.toISOString().slice(0, 10),
    endDate: periodRow.endDate.toISOString().slice(0, 10),
    scheduleId: scheduleRow?.id ?? null,
    scheduleStatus: scheduleRow?.status ?? null,
    assignments,
    guards: guards.map((g) => ({ id: g.id, name: `${g.firstName} ${g.lastName}`.trim() })),
    capacity,
    courtId,
  };
}
// = למצוא משמרות
export async function getShiftsPageData(
  courtId: string,
  options: { includeGuards?: boolean } = {},
): Promise<ShiftsPageData> {
  const periodRow = await getOpenPeriod(courtId);
  if (!periodRow) return { found: false };

  const scheduleRow = await prisma.schedule.findFirst({
    where: { periodId: periodRow.id },
    orderBy: { generatedAt: 'desc' },
  });

  console.log('scheduleRow', scheduleRow);

  const rawAssignments = scheduleRow
    ? await prisma.shiftAssignment.findMany({
        where: { scheduleId: scheduleRow.id },
        include: { employee: { select: { firstName: true, lastName: true } } },
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
      userName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
      isOpeningDuty: a.isOpeningDuty,
    });
  }

  const rawGuards =
    options.includeGuards && courtId
      ? await prisma.employee.findMany({
          where: { courtId, isActive: true },
          select: { id: true, firstName: true, lastName: true },
          orderBy: { firstName: 'asc' },
        })
      : [];

  const guards = rawGuards.map((g) => ({ id: g.id, name: `${g.firstName} ${g.lastName}`.trim() }));

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
export async function getCourtShiftRules(courtId: string): Promise<CourtShiftRuleRow[]> {
  if (!courtId) return [];
  return prisma.courtShiftRule.findMany({
    where: { courtId },
    select: { id: true, shiftType: true, dayCategory: true, position: true, requiredCount: true, displayOrder: true },
    orderBy: [{ dayCategory: 'asc' }, { shiftType: 'asc' }, { displayOrder: 'asc' }],
  });
}
