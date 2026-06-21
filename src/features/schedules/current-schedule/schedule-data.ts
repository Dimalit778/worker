import { calendarDateISO } from '@/features/periods/utils';
import type { ShiftType } from '@/generated/prisma/client';
import type { AssignmentMap, OverflowCandidateMap, ScheduleCapacityRule } from '@/features/schedules/types';
import { WEEKDAY_HEADER_LETTERS } from '@/features/schedules/constants';
import {
  buildScheduleDates,
  buildWeekDays,
  blockedEmployeeIdsForShift,
  createAssignmentCellKey,
  getCapacityForCell,
  getDayCategoryForDate,
  getOrderedPositionsForShift,
} from '@/features/schedules/utils';
import type { DayOption, ShiftSlot } from './types';

const DAY_NAMES = ['יום א', 'יום ב', 'יום ג', 'יום ד', 'יום ה', 'יום ו', 'שבת'] as const;
const SCHEDULE_TIME_ZONE = 'Asia/Jerusalem';

function todayIso(): string {
  return calendarDateISO(new Date(), SCHEDULE_TIME_ZONE);
}

function formatDateLabel(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

export function dayLetter(iso: string): string {
  return WEEKDAY_HEADER_LETTERS[new Date(`${iso}T00:00:00.000Z`).getUTCDay()];
}

export function buildDayOptions(startDate: string, endDate: string): DayOption[] {
  const today = todayIso();

  return buildScheduleDates(startDate, endDate).map((iso) => {
    const [year, month, day] = iso.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    return {
      iso,
      dayName: DAY_NAMES[dayOfWeek],
      dateLabel: formatDateLabel(iso),
      isToday: iso === today,
    };
  });
}

export function buildPeriodWeekGrids(startDate: string, endDate: string, dayByIso: Map<string, DayOption>) {
  const grids: { weekIndex: number; days: (DayOption | null)[] }[] = [];
  let weekIndex = 0;

  while (weekIndex < 2) {
    const weekDays = buildWeekDays(startDate, weekIndex);
    const days: (DayOption | null)[] = Array.from({ length: 7 }, () => null);
    let hasDayInRange = false;

    for (const weekDay of weekDays) {
      if (weekDay.iso < startDate || weekDay.iso > endDate) continue;

      const day = dayByIso.get(weekDay.iso);
      if (!day) continue;

      days[weekDay.dayOfWeek] = day;
      hasDayInRange = true;
    }

    if (!hasDayInRange) break;

    grids.push({ weekIndex, days });
    weekIndex += 1;
  }

  return grids;
}

export function assignedEmployeeIdsForShift(
  assignments: AssignmentMap,
  date: string,
  shiftType: ShiftType,
): Set<string> {
  return blockedEmployeeIdsForShift(assignments, date, shiftType);
}

export function getShiftRequiredCount(date: string, shiftType: ShiftType, capacity: ScheduleCapacityRule[]): number {
  const dayCategory = getDayCategoryForDate(date);
  return getOrderedPositionsForShift(capacity, shiftType).reduce(
    (sum, position) => sum + getCapacityForCell(capacity, dayCategory, shiftType, position.positionId),
    0,
  );
}

export function buildShiftSlots(params: {
  date: string;
  shiftType: ShiftType;
  assignments: AssignmentMap;
  overflowCandidates?: OverflowCandidateMap;
  capacity: ScheduleCapacityRule[];
}): ShiftSlot[] {
  const { date, shiftType, assignments, overflowCandidates, capacity } = params;
  const dayCategory = getDayCategoryForDate(date);
  const slots: ShiftSlot[] = [];
  const knownPositionIds = new Set<string>();

  for (const position of getOrderedPositionsForShift(capacity, shiftType)) {
    knownPositionIds.add(position.positionId);

    const cellKey = createAssignmentCellKey({ date, shiftType, positionId: position.positionId });
    const assigned = [...(assignments[cellKey] ?? [])].sort((a, b) => a.slotIndex - b.slotIndex);
    const assignedBySlot = new Map(assigned.map((assignment) => [assignment.slotIndex, assignment]));
    const required = getCapacityForCell(capacity, dayCategory, shiftType, position.positionId);
    const maxSlotCount = Math.max(required, assigned.length ? Math.max(...assigned.map((a) => a.slotIndex)) + 1 : 0);

    for (let slotIndex = 0; slotIndex < maxSlotCount; slotIndex += 1) {
      const assignment = assignedBySlot.get(slotIndex) ?? null;
      const overflowKey = `${cellKey}-${slotIndex}` as keyof OverflowCandidateMap;

      slots.push({
        key: `${cellKey}-${slotIndex}`,
        positionId: position.positionId,
        positionName: position.positionName,
        positionCode: position.positionCode,
        positionColor: position.positionColor,
        slotIndex,
        requiredCount: required,
        assignment,
        overflowCandidates: overflowCandidates?.[overflowKey] ?? [],
      });
    }
  }

  Object.entries(assignments)
    .filter(([key]) => key.startsWith(`${date}-${shiftType}-`))
    .flatMap(([cellKey, list]) =>
      list
        .filter((assignment) => !knownPositionIds.has(assignment.positionId))
        .map((assignment) => {
          const overflowKey = `${cellKey}-${assignment.slotIndex}` as keyof OverflowCandidateMap;

          return {
            key: `${cellKey}-${assignment.slotIndex}`,
            positionId: assignment.positionId,
            positionName: assignment.positionName,
            positionCode: Number.MAX_SAFE_INTEGER,
            positionColor: null,
            slotIndex: assignment.slotIndex,
            requiredCount: 0,
            assignment,
            overflowCandidates: overflowCandidates?.[overflowKey] ?? [],
          };
        }),
    )
    .forEach((slot) => slots.push(slot));

  return slots.sort(
    (a, b) =>
      a.positionCode - b.positionCode ||
      a.slotIndex - b.slotIndex ||
      a.positionName.localeCompare(b.positionName, 'he'),
  );
}
