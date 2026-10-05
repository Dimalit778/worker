import type { ShiftType } from '@/generated/prisma/client';
import type { AssignmentCellKey, AssignmentMap, ScheduleCapacityRule, StaffingDayCategory, WeekDay } from './types';
import { EVENING_SLOT_LABELS, MORNING_SLOT_LABELS, NIGHT_SLOT_LABELS, WEEKDAY_HEADER_LETTERS } from './constants';

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createAssignmentCellKey(params: {
  date: string;
  shiftType: ShiftType;
  positionId: string;
}): AssignmentCellKey {
  return `${params.date}-${params.shiftType}-${params.positionId}`;
}

/** ISO week slice starting at period `startDate` + `weekIndex` × 7 days */
export function buildWeekDays(startDateISO: string, weekIndex: number): WeekDay[] {
  const [y, m, d] = startDateISO.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d + weekIndex * 7));

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i));
    const iso = date.toISOString().slice(0, 10);
    const dayOfWeek = date.getUTCDay();
    const letter = WEEKDAY_HEADER_LETTERS[dayOfWeek];
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    return { iso, dayOfWeek, letter, label: `${dd}/${mm}` };
  });
}

/** Inclusive list of calendar dates from start through end (UTC date-only). */
export function buildScheduleDates(startDateISO: string, endDateISO: string): string[] {
  const [ys, ms, ds] = startDateISO.split('-').map(Number);
  const [ye, me, de] = endDateISO.split('-').map(Number);
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(ys, ms - 1, ds));
  const end = new Date(Date.UTC(ye, me - 1, de));
  while (cursor <= end) {
    dates.push(toDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function addIsoDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return toDateOnly(date);
}

/**
 * Maps a calendar date to staffing day category.
 * Holidays are not detected here; use HOLIDAY only when the caller supplies holiday dates.
 */
export function getDayCategoryForDate(isoDate: string, holidayIsoSet?: ReadonlySet<string>): StaffingDayCategory {
  if (holidayIsoSet?.has(isoDate)) return 'HOLIDAY';
  const [y, m, d] = isoDate.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (day === 5) return 'FRIDAY';
  if (day === 6) return 'SATURDAY';
  return 'WEEKDAY';
}

export function getCapacityForCell(
  rules: ScheduleCapacityRule[],
  dayCategory: StaffingDayCategory,
  shiftType: ShiftType,
  positionId: string,
): number {
  const row = rules.find(
    (r) => r.dayCategory === dayCategory && r.shiftType === shiftType && r.positionId === positionId,
  );
  return row?.amount ?? 0;
}

/** Unique positions that have capacity for this shift, sorted by `Position.displayOrder` then name */
export function getOrderedPositionsForShift(
  rules: ScheduleCapacityRule[],
  shiftType: ShiftType,
): Array<{ positionId: string; positionName: string; positionRank: number; positionColor: string | null }> {
  const map = new Map<
    string,
    { positionId: string; positionName: string; positionRank: number; positionColor: string | null }
  >();
  for (const r of rules) {
    if (r.shiftType !== shiftType) continue;
    if (!map.has(r.positionId)) {
      map.set(r.positionId, {
        positionId: r.positionId,
        positionName: r.displayName,
        positionRank: r.rank,
        positionColor: r.color,
      });
    }
  }
  return [...map.values()].sort(
    (a, b) => a.positionRank - b.positionRank || a.positionName.localeCompare(b.positionName, 'he'),
  );
}

export function blockedEmployeeIdsForShift(
  assignments: AssignmentMap,
  date: string,
  shiftType: ShiftType,
): Set<string> {
  const conflictingShiftRefs: Array<{ date: string; shiftType: ShiftType }> = [{ date, shiftType }];

  if (shiftType === 'MORNING') {
    conflictingShiftRefs.push({ date, shiftType: 'EVENING' });
    conflictingShiftRefs.push({ date: addIsoDays(date, -1), shiftType: 'NIGHT' });
  } else if (shiftType === 'EVENING') {
    conflictingShiftRefs.push({ date, shiftType: 'MORNING' });
    conflictingShiftRefs.push({ date, shiftType: 'NIGHT' });
  } else {
    conflictingShiftRefs.push({ date, shiftType: 'EVENING' });
    conflictingShiftRefs.push({ date: addIsoDays(date, 1), shiftType: 'MORNING' });
  }

  const prefixes = conflictingShiftRefs.map((ref) => `${ref.date}-${ref.shiftType}-`);

  return new Set(
    Object.entries(assignments)
      .filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix)))
      .flatMap(([, list]) => list.map((assignment) => assignment.employeeId)),
  );
}

/** Max required headcount for this position+shift across the given dates (for slot rows). */
/** Guard rows use a blank תפקיד label (DB `Position.name` is often מאבטח or legacy GUARD). */
export function isGuardPositionLabel(positionName: string): boolean {
  const t = positionName.trim();
  if (t === 'מאבטח') return true;
  const u = t.toUpperCase();
  return u === 'GUARD' || u === 'GUARDE';
}

export function maxSlotsForPositionInWeek(
  rules: ScheduleCapacityRule[],
  shiftType: ShiftType,
  positionId: string,
  weekIsoDates: string[],
  holidayIsoSet?: ReadonlySet<string>,
): number {
  let max = 0;
  for (const iso of weekIsoDates) {
    const cat = getDayCategoryForDate(iso, holidayIsoSet);
    max = Math.max(max, getCapacityForCell(rules, cat, shiftType, positionId));
  }
  return max;
}

export function getShiftSlotLabel(shiftType: ShiftType, slotIndex: number): string {
  const map =
    shiftType === 'MORNING' ? MORNING_SLOT_LABELS : shiftType === 'EVENING' ? EVENING_SLOT_LABELS : NIGHT_SLOT_LABELS;
  if (map[slotIndex] !== undefined) return map[slotIndex];
  const keys = Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b);
  return map[keys[keys.length - 1]] ?? '';
}
