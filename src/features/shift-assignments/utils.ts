import type { Position, ShiftType } from '@/generated/prisma/client';
import type { AssignmentCellKey, DisplayRow, WeekDay } from './types';
import { CapacityMap, CourtShiftRoleWithRules, FullCapacityRules } from '../court-settings/types';
import { HEB_LETTERS, MORNING_LABELS, EVENING_LABELS, NIGHT_LABELS, POSITION_ORDER, POSITION_LABELS } from './constans';
const buildWeekDays = (startDateISO: string, weekIndex: number): WeekDay[] => {
  const [y, m, d] = startDateISO.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d + weekIndex * 7));

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i));
    const iso = date.toISOString().slice(0, 10);
    const dayOfWeek = date.getUTCDay(); // 0=Sun
    const letter = HEB_LETTERS[dayOfWeek];
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    return { iso, dayOfWeek, letter, label: `${dd}/${mm}` };
  });
};
const assignmentKey = (isoDate: string, shiftType: ShiftType): string => {
  return `${isoDate}-${shiftType}`;
};

const getRowLabel = (shiftType: ShiftType, slotIndex: number): string => {
  const map = shiftType === 'MORNING' ? MORNING_LABELS : shiftType === 'EVENING' ? EVENING_LABELS : NIGHT_LABELS;
  if (map[slotIndex] !== undefined) return map[slotIndex];
  const keys = Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b);
  return map[keys[keys.length - 1]] ?? '';
};
const getDayCapacity = (capacity: FullCapacityRules, dayOfWeek: number) => {
  if (dayOfWeek === 5) return capacity.friday;
  if (dayOfWeek === 6) return capacity.saturday;
  return capacity.default;
};

export function buildCapacityRules(roles: CourtShiftRoleWithRules[]): FullCapacityRules {
  const emptyCapacityMap = (): CapacityMap => ({ MORNING: {}, EVENING: {}, NIGHT: {} });
  const result: FullCapacityRules = {
    default: emptyCapacityMap(),
    friday: emptyCapacityMap(),
    saturday: emptyCapacityMap(),
  };

  for (const role of roles) {
    for (const rule of role.staffingRules) {
      const key: keyof FullCapacityRules =
        rule.dayCategory === 'FRIDAY' ? 'friday' : rule.dayCategory === 'SATURDAY' ? 'saturday' : 'default';
    }
  }

  return result;
}
export { buildWeekDays, assignmentKey, getRowLabel, getDayCapacity };
// = utils for shift assignments
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatEmployeeName(employee: { firstName: string; lastName: string }): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export function getAssignmentCellKey(params: { date: Date; shiftType: ShiftType; positionId: string }) {
  return `${toDateOnly(params.date)}-${params.shiftType}-${params.positionId}`;
}
export function createAssignmentCellKey(params: {
  date: string;
  shiftType: ShiftType;
  positionId: string;
}): AssignmentCellKey {
  return `${params.date}-${params.shiftType}-${params.positionId}`;
}
