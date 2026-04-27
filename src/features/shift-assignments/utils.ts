import type { Position, ShiftType } from '@/generated/prisma/client';
import type { DisplayRow, WeekDay } from './types';
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
const getMaxCountForPosition = (
  capacity: FullCapacityRules,
  weekDays: WeekDay[],
  shiftType: ShiftType,
  position: Position,
) => {
  return Math.max(
    ...weekDays.map((day) => {
      const dayCapacity = getDayCapacity(capacity, day.dayOfWeek)[shiftType];
      return dayCapacity?.[position] ?? 0;
    }),
    0,
  );
};

const buildRowsForWeek = (capacity: FullCapacityRules, weekDays: WeekDay[], shiftType: ShiftType): DisplayRow[] => {
  const rows: DisplayRow[] = [];
  let globalSlotIndex = 0;

  for (const position of POSITION_ORDER) {
    const maxCount = getMaxCountForPosition(capacity, weekDays, shiftType, position);

    for (let i = 0; i < maxCount; i++) {
      rows.push({
        key: `${shiftType}-${position}-${i}`,
        label: maxCount === 1 ? POSITION_LABELS[position] : `${POSITION_LABELS[position]} ${i + 1}`,
        position,
        slotIndex: globalSlotIndex,
        roleSlotIndex: i,
        isGroupStart: i === 0,
      });

      globalSlotIndex++;
    }
  }

  return rows;
};

function getShiftSummary(capacity: FullCapacityRules, shiftType: ShiftType) {
  const defaultCapacity = capacity.default[shiftType];

  const shiftManagerCount = defaultCapacity?.SHIFT_MANAGER ?? 0;
  const bakarCount = defaultCapacity?.BAKAR ?? 0;
  const facilityOfficerCount = defaultCapacity?.FACILITY_OFFICER ?? 0;
  const guardCount = defaultCapacity?.GUARD ?? 0;

  const parts = [
    shiftManagerCount > 0 ? `${shiftManagerCount} אחמ״ש` : null,
    bakarCount > 0 ? `${bakarCount} בקר` : null,
    facilityOfficerCount > 0 ? `${facilityOfficerCount} קצין מתקן` : null,
    guardCount > 0 ? `${guardCount} מאבטחים` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'אין תקנים';
}
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
export {
  buildWeekDays,
  assignmentKey,
  getRowLabel,
  getDayCapacity,
  getMaxCountForPosition,
  buildRowsForWeek,
  getShiftSummary,
};
