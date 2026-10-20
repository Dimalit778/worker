import { DayCategory, EngineAssignment, FairnessSummary } from "./types";
import { getDayCategory } from "./slots";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function createEmptyFairnessSummary(employeeId: string): FairnessSummary {
  return {
    employeeId,
    totalShifts: 0,
    morningShifts: 0,
    eveningShifts: 0,
    nightShifts: 0,
    weekendShifts: 0,
  };
}

// Returns a new FairnessSummary with counters incremented for one assignment.
// Pure — does not mutate the input summary.
export function incrementFairnessForAssignment(
  summary: FairnessSummary,
  assignment: EngineAssignment,
  dayCategory: DayCategory
): FairnessSummary {
  const isWeekend =
    dayCategory === "FRIDAY" ||
    dayCategory === "SATURDAY" ||
    dayCategory === "HOLIDAY";

  return {
    ...summary,
    totalShifts: summary.totalShifts + 1,
    morningShifts: summary.morningShifts + (assignment.shiftType === "MORNING" ? 1 : 0),
    eveningShifts: summary.eveningShifts + (assignment.shiftType === "EVENING" ? 1 : 0),
    nightShifts: summary.nightShifts + (assignment.shiftType === "NIGHT" ? 1 : 0),
    weekendShifts: summary.weekendShifts + (isWeekend ? 1 : 0),
  };
}

// Builds the complete fairness map from all assignments (manual + generated).
// Employees with no assignments do not appear in the map.
export function computeFairnessSummary(
  assignments: EngineAssignment[],
  holidayCategories?: Map<string, DayCategory>,
): Map<string, FairnessSummary> {
  const result = new Map<string, FairnessSummary>();

  for (const a of assignments) {
    if (a.isExtension) continue;
    const dayCategory = holidayCategories?.get(a.date.toISOString().slice(0, 10)) ?? getDayCategory(a.date);
    const current = result.get(a.employeeId) ?? createEmptyFairnessSummary(a.employeeId);
    result.set(a.employeeId, incrementFairnessForAssignment(current, a, dayCategory));
  }

  return result;
}
