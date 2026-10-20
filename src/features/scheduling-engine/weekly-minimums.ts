import {
  EngineAssignment,
  EngineInput,
  EngineSlot,
  UnmetMinimum,
} from "./types";
import { repairMinimum } from './minimum-repair';
import { computeFairnessSummary } from './fairness';
import { sortCandidatesByScore } from './scoring';
import { canAssignEmployeeToSlot, getSlotFillCount, hasShiftConflict, isSameDate } from "./constraints";

// ─── Constants ────────────────────────────────────────────────────────────────

export const MORNING_MINIMUM = 2;
export const EVENING_MINIMUM = 1;

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

/** Only weeks actually present in the period participate in minimums and warnings. */
export function getPeriodWeeks(input: EngineInput): Array<1 | 2> {
  return ([1, 2] as const).filter(week =>
    (week === 1 ? input.week1Dates : input.week2Dates).length > 0);
}

export function collectUnmetMinimums(input: EngineInput, assignments: EngineAssignment[]): UnmetMinimum[] {
  const counts = countWeeklyShifts(assignments, input);
  const unmet: UnmetMinimum[] = [];
  for (const weekNumber of getPeriodWeeks(input)) {
    for (const employee of input.employees.filter(e => e.isActive && e.facilityId === input.period.facilityId)) {
      const week = weekNumber === 1 ? counts.get(employee.id)?.week1 : counts.get(employee.id)?.week2;
      for (const [shiftType, required] of [["MORNING", MORNING_MINIMUM], ["EVENING", EVENING_MINIMUM]] as const) {
        const actual = week?.[shiftType] ?? 0;
        if (actual < required) unmet.push({ employeeId: employee.id, weekNumber, shiftType, required, actual });
      }
    }
  }
  return unmet;
}

/**
 * Complete minimums before any extras. Each round gives everyone a chance at
 * one morning, then a second morning, then an evening. Limited availability
 * goes first; shift balancing must never veto a minimum placement.
 */
export function assignWeeklyMinimums(
  input: EngineInput,
  slots: EngineSlot[],
  _slotFillCounts: Map<string, number>,
  assignments: EngineAssignment[]
): { newAssignments: EngineAssignment[]; unmetMinimums: UnmetMinimum[] } {
  const working = [...assignments];
  const original = new Set(assignments);
  const employees = input.employees.filter(e => e.isActive && e.facilityId === input.period.facilityId);
  const rounds = [
    { shiftType: "MORNING", target: 1 },
    { shiftType: "MORNING", target: MORNING_MINIMUM },
    { shiftType: "EVENING", target: EVENING_MINIMUM },
  ] as const;

  for (const { shiftType, target } of rounds) {
    for (const weekNumber of getPeriodWeeks(input)) {
      const dates = new Set((weekNumber === 1 ? input.week1Dates : input.week2Dates).map(d => d.toISOString().slice(0, 10)));
      const weekSlots = slots.filter(s => dates.has(s.date.toISOString().slice(0, 10)));
      const count = (id: string) => working.filter(a => a.employeeId === id && a.shiftType === shiftType && dates.has(a.date.toISOString().slice(0, 10))).length;
      const options = (employee: EngineInput["employees"][number], onlyRound: boolean) => weekSlots.filter(slot =>
        (onlyRound ? slot.shiftType === shiftType : slot.shiftType !== "NIGHT") &&
        canAssignEmployeeToSlot(employee, slot, working, input.availability));
      const fairness = computeFairnessSummary([...(input.historicalAssignments ?? []), ...working.filter(a =>
        a.date >= input.period.startDate && a.date <= input.period.endDate)], input.holidayCategories);
      const representative = weekSlots.find(s => s.shiftType === shiftType);
      const fairOrder = representative ? sortCandidatesByScore(employees, representative, fairness, input.preferences) : employees;
      const order = fairOrder.filter(e => count(e.id) < target).map(employee => ({
        employee, choices: options(employee, true).length, alternatives: options(employee, false).length,
      })).sort((a, b) => a.choices - b.choices || a.alternatives - b.alternatives);

      for (const { employee } of order) {
        if (count(employee.id) >= target) continue;
        const choices = options(employee, true);
        // Preserve scarce roles and leave other employees their few available dates.
        const ranked = choices.map(slot => ({ slot, competition: employees.filter(other =>
          other.id !== employee.id && count(other.id) < target &&
          canAssignEmployeeToSlot(other, slot, working, input.availability)).length }));
        const preferred = (slot: EngineSlot) => Number(input.preferences?.get(employee.id)?.has(`${slot.date.toISOString().slice(0, 10)}|${slot.shiftType}`) ?? false);
        // Avoid consuming a rare weekend opportunity with an adjacent weekday
        // minimum when another legal minimum placement exists.
        const lostWeekendOptions = (slot: EngineSlot) => slot.dayCategory !== 'WEEKDAY' ? 0 : slots.filter(other =>
          other.dayCategory !== 'WEEKDAY' && hasShiftConflict(slot.date, slot.shiftType, other.date, other.shiftType) &&
          canAssignEmployeeToSlot(employee, other, working, input.availability)).length;
        // Preserve scarce roles first, then honor submitted preferences before competition ties.
        ranked.sort((a, b) => a.slot.requiredRank - b.slot.requiredRank || preferred(b.slot) - preferred(a.slot) ||
          lostWeekendOptions(a.slot) - lostWeekendOptions(b.slot) || a.competition - b.competition);
        const slot = ranked[0]?.slot;
        if (!slot) continue;
        const assignment: EngineAssignment = {
          employeeId: employee.id, facilityId: slot.facilityId, positionId: slot.positionId,
          positionName: slot.positionName, date: slot.date, shiftType: slot.shiftType,
          slotIndex: getSlotFillCount(slot, working), isManualOverride: false,
        };
        working.push(assignment);
      }
      // Repair earlier choices before moving to the next minimum round or to extras.
      for (const { employee } of order) {
        if (count(employee.id) >= target) continue;
        const repaired = repairMinimum(input, slots, working, employee, weekSlots.filter(s => s.shiftType === shiftType));
        if (repaired) working.splice(0, working.length, ...repaired);
      }
    }
  }
  // An exchange for a later round may open an earlier minimum opportunity.
  // Every successful pass adds a minimum, so this loop is bounded by the total deficit.
  while (true) {
    let improved = false;
    for (const unmet of collectUnmetMinimums(input, working)) {
      const employee = employees.find(e => e.id === unmet.employeeId)!;
      const targetSlots = slots.filter(s => s.shiftType === unmet.shiftType && getWeekNumberForDate(s.date, input) === unmet.weekNumber);
      const repaired = repairMinimum(input, slots, working, employee, targetSlots);
      if (repaired) {
        working.splice(0, working.length, ...repaired);
        improved = true;
      }
    }
    if (!improved) break;
  }
  return { newAssignments: working.filter(a => !original.has(a)), unmetMinimums: collectUnmetMinimums(input, working) };
}
