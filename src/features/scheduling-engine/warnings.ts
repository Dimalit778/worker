import {
  EngineAssignment,
  EngineSlot,
  EngineWarning,
  FairnessSummary,
  UnmetMinimum,
} from "./types";
import { getSlotFillCount } from "./constraints";
import { createDateKey } from "./slots";

// ─── Minimum warnings ─────────────────────────────────────────────────────────

// Every UnmetMinimum becomes a MIN_NOT_MET ERROR.
export function createMinimumWarnings(unmetMinimums: UnmetMinimum[]): EngineWarning[] {
  return unmetMinimums.map((u) => ({
    type: "MIN_NOT_MET" as const,
    severity: "ERROR" as const,
    employeeId: u.employeeId,
    shiftType: u.shiftType,
    message: `Week ${u.weekNumber}: needs ${u.required} ${u.shiftType} shift(s), has ${u.actual}`,
  }));
}

// ─── Capacity warnings ────────────────────────────────────────────────────────

// UNFILLED (ERROR): slot has 0 assigned employees.
// UNDERSTAFFED (ERROR): slot is partially filled below requiredAmount.
export function createCapacityWarnings(
  slots: EngineSlot[],
  assignments: EngineAssignment[]
): EngineWarning[] {
  const warnings: EngineWarning[] = [];

  for (const slot of slots) {
    const fillCount = getSlotFillCount(slot, assignments);

    if (fillCount === 0 && slot.requiredAmount > 0) {
      warnings.push({
        type: "UNFILLED",
        severity: "ERROR",
        positionId: slot.positionId,
        date: slot.date,
        shiftType: slot.shiftType,
        message: `${slot.shiftType} on ${createDateKey(slot.date)}: 0/${slot.requiredAmount} assigned`,
      });
    } else if (fillCount > 0 && fillCount < slot.requiredAmount) {
      warnings.push({
        type: "UNDERSTAFFED",
        severity: "ERROR",
        positionId: slot.positionId,
        date: slot.date,
        shiftType: slot.shiftType,
        message: `${slot.shiftType} on ${createDateKey(slot.date)}: ${fillCount}/${slot.requiredAmount} assigned`,
      });
    }
  }

  return warnings;
}

// ─── Fairness warnings ────────────────────────────────────────────────────────

// FAIRNESS (INFO): employee has >= 2x the average total shifts.
// Only computed when the average across assigned employees is > 0.
export function createFairnessWarnings(
  fairnessSummary: Map<string, FairnessSummary>
): EngineWarning[] {
  const summaries = Array.from(fairnessSummary.values());
  if (summaries.length === 0) return [];

  const total = summaries.reduce((sum, s) => sum + s.totalShifts, 0);
  const average = total / summaries.length;

  if (average === 0) return [];

  return summaries
    .filter((s) => s.totalShifts >= average * 2)
    .map((s) => ({
      type: "FAIRNESS" as const,
      severity: "INFO" as const,
      employeeId: s.employeeId,
      message: `${s.totalShifts} shifts assigned (average: ${average.toFixed(1)})`,
    }));
}

// ─── Combined entry point ─────────────────────────────────────────────────────

export function createWarnings({
  unmetMinimums,
  slots,
  assignments,
  fairnessSummary,
}: {
  unmetMinimums: UnmetMinimum[];
  slots: EngineSlot[];
  assignments: EngineAssignment[];
  fairnessSummary: Map<string, FairnessSummary>;
}): EngineWarning[] {
  return [
    ...createMinimumWarnings(unmetMinimums),
    ...createCapacityWarnings(slots, assignments),
    ...createFairnessWarnings(fairnessSummary),
  ];
}
