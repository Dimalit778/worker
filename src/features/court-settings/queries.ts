import { prisma } from '@/lib/db/client';
import type { CapacityMap, CourtShiftRoleRow, CourtStaffRuleRow, FullCapacityRules } from './types';
import { DayCategory } from '@/generated/prisma/client';

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
    return {
      default: { ...DEFAULT_CAPACITY },
      friday: { ...DEFAULT_FRIDAY },
      saturday: { ...DEFAULT_SATURDAY },
    };
  }

  const rows = await prisma.courtStaffRule.findMany({
    where: {
      courtShiftRole: {
        courtId,
        isActive: true,
      },
    },
    select: {
      requiredCount: true,
      dayCategory: true,
      courtShiftRole: {
        select: {
          shiftType: true,
        },
      },
    },
  });

  function buildCapacityMap(category: DayCategory, defaults: CapacityMap): CapacityMap {
    const filtered = rows
      .filter((r) => r.dayCategory === category)
      .map((r) => ({
        shiftType: r.courtShiftRole.shiftType,
        maxStaff: r.requiredCount,
      }));

    return mergeCapacityRules(filtered, defaults);
  }

  return {
    default: buildCapacityMap(DayCategory.WEEKDAY, DEFAULT_CAPACITY),
    friday: buildCapacityMap(DayCategory.FRIDAY, DEFAULT_FRIDAY),
    saturday: buildCapacityMap(DayCategory.SATURDAY, DEFAULT_SATURDAY),
  };
}

export async function getCourtShiftRoles(courtId: string): Promise<CourtShiftRoleRow[]> {
  if (!courtId) return [];
  const rows = await prisma.courtShiftRole.findMany({
    where: { courtId },
    select: { id: true, code: true, name: true, shiftType: true, isActive: true, displayOrder: true },
    orderBy: [{ displayOrder: 'asc' }],
  });
  return rows;
}
