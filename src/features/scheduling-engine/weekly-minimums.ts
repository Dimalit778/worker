import {
  EngineAssignment,
  EngineEmployee,
  EngineInput,
  EngineSlot,
  ShiftType,
  UnmetMinimum,
} from "./types";
import { canAssignEmployeeToSlot, getSlotFillCount, isSameDate } from "./constraints";

// ─── Constants ────────────────────────────────────────────────────────────────

const MORNING_MINIMUM = 2;
const EVENING_MINIMUM = 1;

// ─── Local types ──────────────────────────────────────────────────────────────

interface WeeklyShiftCounts {
  MORNING: number;
  EVENING: number;
  NIGHT: number;
}

export interface WeeklyMinimumStatus {
  morningCount: number;
  eveningCount: number;
  morningNeeded: number;
  eveningNeeded: number;
  morningMet: boolean;
  eveningMet: boolean;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

// Returns 1 if the date falls in week1Dates, 2 if in week2Dates, null otherwise.
export function getWeekNumberForDate(
  date: Date,
  input: EngineInput
): 1 | 2 | null {
  if (input.week1Dates.some((d) => isSameDate(d, date))) return 1;
  if (input.week2Dates.some((d) => isSameDate(d, date))) return 2;
  return null;
}

// Returns per-employee, per-week shift counts across all provided assignments.
// Useful for inspection and test assertions.
export function countWeeklyShifts(
  assignments: EngineAssignment[],
  input: EngineInput
): Map<string, { week1: WeeklyShiftCounts; week2: WeeklyShiftCounts }> {
  const result = new Map<
    string,
    { week1: WeeklyShiftCounts; week2: WeeklyShiftCounts }
  >();

  const empty = (): WeeklyShiftCounts => ({ MORNING: 0, EVENING: 0, NIGHT: 0 });

  for (const a of assignments) {
    const week = getWeekNumberForDate(a.date, input);
    if (week === null) continue;

    if (!result.has(a.employeeId)) {
      result.set(a.employeeId, { week1: empty(), week2: empty() });
    }

    const counts = result.get(a.employeeId)!;
    const target = week === 1 ? counts.week1 : counts.week2;
    target[a.shiftType]++;
  }

  return result;
}

// Returns the minimum satisfaction status for one employee for one week.
export function getWeeklyMinimumStatus(
  employeeId: string,
  weekNumber: 1 | 2,
  assignments: EngineAssignment[],
  input: EngineInput
): WeeklyMinimumStatus {
  const allCounts = countWeeklyShifts(assignments, input);
  const entry = allCounts.get(employeeId);
  const week = weekNumber === 1 ? entry?.week1 : entry?.week2;

  const morningCount = week?.MORNING ?? 0;
  const eveningCount = week?.EVENING ?? 0;

  return {
    morningCount,
    eveningCount,
    morningNeeded: Math.max(0, MORNING_MINIMUM - morningCount),
    eveningNeeded: Math.max(0, EVENING_MINIMUM - eveningCount),
    morningMet: morningCount >= MORNING_MINIMUM,
    eveningMet: eveningCount >= EVENING_MINIMUM,
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

// Counts how many shifts of shiftType an employee has within the given date
// set. Uses timestamp lookup (O(1)) since all engine dates are midnight UTC.
function countShiftsInDates(
  employeeId: string,
  shiftType: ShiftType,
  dateTimes: Set<number>,
  assignments: EngineAssignment[]
): number {
  return assignments.filter(
    (a) =>
      a.employeeId === employeeId &&
      a.shiftType === shiftType &&
      dateTimes.has(a.date.getTime())
  ).length;
}

// Total shift count across all dates; used to sort employees by workload within a round.
function totalShiftCount(
  employeeId: string,
  assignments: EngineAssignment[]
): number {
  return assignments.filter((a) => a.employeeId === employeeId).length;
}

// Finds the first slot of the given shiftType within the given date set where
// all hard constraints pass for this employee. Does not mutate assignments.
function findAvailableSlot(
  employee: EngineEmployee,
  shiftType: ShiftType,
  dateTimes: Set<number>,
  slots: EngineSlot[],
  assignments: EngineAssignment[],
  availability: Map<string, Set<string>>
): EngineSlot | null {
  for (const slot of slots) {
    if (slot.shiftType !== shiftType) continue;
    if (!dateTimes.has(slot.date.getTime())) continue;
    if (canAssignEmployeeToSlot(employee, slot, assignments, availability)) {
      return slot;
    }
  }
  return null;
}

// ─── Phase 1 — Main assignment function ──────────────────────────────────────

// Attempts to satisfy the weekly minimums for every active employee using a
// round-based approach so no single employee gets their second shift before
// every employee has had a chance at their first.
//
// Round order per week:
//   1. First  MORNING (targetCount = 1)
//   2. Second MORNING (targetCount = 2)
//   3. First  EVENING (targetCount = 1)
//
// Within each round employees are sorted by fewest total assignments so far.
// Hard constraints are always enforced. If a slot cannot be found the
// employee is left unmet and included in unmetMinimums — no exception thrown.
//
// slotFillCounts is accepted for interface compatibility with the engine
// orchestrator; fill counts are derived live from workingAssignments instead.
export function assignWeeklyMinimums(
  input: EngineInput,
  slots: EngineSlot[],
  _slotFillCounts: Map<string, number>,
  assignments: EngineAssignment[]
): { newAssignments: EngineAssignment[]; unmetMinimums: UnmetMinimum[] } {
  // Working copy grows as we assign; never mutates the caller's array.
  const workingAssignments = [...assignments];
  const newAssignments: EngineAssignment[] = [];

  const activeEmployees = input.employees.filter((e) => e.isActive);

  for (const weekNumber of [1, 2] as const) {
    const weekDates = weekNumber === 1 ? input.week1Dates : input.week2Dates;
    const dateTimes = new Set(weekDates.map((d) => d.getTime()));

    const rounds: Array<{ shiftType: "MORNING" | "EVENING"; targetCount: number }> = [
      { shiftType: "MORNING", targetCount: 1 },
      { shiftType: "MORNING", targetCount: 2 },
      { shiftType: "EVENING", targetCount: 1 },
    ];

    for (const { shiftType, targetCount } of rounds) {
      // Re-sort each round so the employee with the least work is served first.
      const sortedEmployees = [...activeEmployees].sort(
        (a, b) =>
          totalShiftCount(a.id, workingAssignments) -
          totalShiftCount(b.id, workingAssignments)
      );

      for (const employee of sortedEmployees) {
        const currentCount = countShiftsInDates(
          employee.id,
          shiftType,
          dateTimes,
          workingAssignments
        );

        if (currentCount >= targetCount) continue;

        const slot = findAvailableSlot(
          employee,
          shiftType,
          dateTimes,
          slots,
          workingAssignments,
          input.availability
        );

        if (!slot) continue; // will become UnmetMinimum after all rounds

        const assignment: EngineAssignment = {
          employeeId: employee.id,
          courtId: slot.courtId,
          positionId: slot.positionId,
          positionName: slot.positionName,
          date: slot.date,
          shiftType: slot.shiftType,
          slotIndex: getSlotFillCount(slot, workingAssignments),
          isManualOverride: false,
        };

        workingAssignments.push(assignment);
        newAssignments.push(assignment);
      }
    }
  }

  // ─── Collect unmet minimums ───────────────────────────────────────────────

  const unmetMinimums: UnmetMinimum[] = [];

  for (const weekNumber of [1, 2] as const) {
    const weekDates = weekNumber === 1 ? input.week1Dates : input.week2Dates;
    const dateTimes = new Set(weekDates.map((d) => d.getTime()));

    for (const employee of activeEmployees) {
      const morningCount = countShiftsInDates(
        employee.id,
        "MORNING",
        dateTimes,
        workingAssignments
      );
      const eveningCount = countShiftsInDates(
        employee.id,
        "EVENING",
        dateTimes,
        workingAssignments
      );

      if (morningCount < MORNING_MINIMUM) {
        unmetMinimums.push({
          employeeId: employee.id,
          weekNumber,
          shiftType: "MORNING",
          required: MORNING_MINIMUM,
          actual: morningCount,
        });
      }

      if (eveningCount < EVENING_MINIMUM) {
        unmetMinimums.push({
          employeeId: employee.id,
          weekNumber,
          shiftType: "EVENING",
          required: EVENING_MINIMUM,
          actual: eveningCount,
        });
      }
    }
  }

  return { newAssignments, unmetMinimums };
}
