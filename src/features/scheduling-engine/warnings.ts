import {
  EngineAssignment,
  EngineSlot,
  EngineWarning,
  FairnessSummary,
  UnmetMinimum,
} from "./types";
import { getSlotFillCount } from "./constraints";
import { createDateKey } from "./slots";

const SHIFT_LABELS = {
  MORNING: "בוקר",
  EVENING: "ערב",
  NIGHT: "לילה",
} as const;

// ─── Minimum warnings ─────────────────────────────────────────────────────────

// Every UnmetMinimum becomes a MIN_NOT_MET ERROR.
export function createMinimumWarnings(unmetMinimums: UnmetMinimum[]): EngineWarning[] {
  return unmetMinimums.map((u) => ({
    type: "MIN_NOT_MET" as const,
    severity: "ERROR" as const,
    employeeId: u.employeeId,
    shiftType: u.shiftType,
    message: `שבוע ${u.weekNumber}: ${u.required === 1 ? `נדרשת משמרת ${SHIFT_LABELS[u.shiftType]} אחת` : `נדרשות ${u.required} משמרות ${SHIFT_LABELS[u.shiftType]}`}; בפועל: ${u.actual}.`,
  }));
}

// ─── Mandatory staffing warnings ─────────────────────────────────────────────

// Only the manager's mandatory headcount raises shortages; the rest of the
// staffing requirement is filled when possible without warnings.
export function createMandatoryStaffingWarnings(
  slots: EngineSlot[],
  assignments: EngineAssignment[]
): EngineWarning[] {
  const warnings: EngineWarning[] = [];

  for (const slot of slots) {
    const required = slot.mandatoryAmount ?? 0;
    const fillCount = getSlotFillCount(slot, assignments);
    if (fillCount >= required) continue;

    warnings.push({
      type: fillCount === 0 ? "UNFILLED" : "UNDERSTAFFED",
      severity: "ERROR",
      positionId: slot.positionId,
      date: slot.date,
      shiftType: slot.shiftType,
      message: `${createDateKey(slot.date).split("-").reverse().join("/")} · ${SHIFT_LABELS[slot.shiftType]} — ${slot.positionName ?? "תפקיד"}: משובצים ${fillCount} מתוך ${required} בחובה.`,
    });
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
      message: `מספר המשמרות ששובצו: ${s.totalShifts}; הממוצע לעובד: ${average.toFixed(1)}.`,
    }));
}

// ─── Time-off warnings ────────────────────────────────────────────────────────

// Existing assignments that fall on an employee's approved time off.
export function createTimeOffWarnings(
  assignments: EngineAssignment[],
  timeOff: Map<string, Set<string>> = new Map()
): EngineWarning[] {
  return assignments
    .filter((a) => timeOff.get(a.employeeId)?.has(createDateKey(a.date)))
    .map((a) => ({
      type: "CONFLICT" as const,
      severity: "ERROR" as const,
      employeeId: a.employeeId,
      positionId: a.positionId,
      date: a.date,
      shiftType: a.shiftType,
      message: `${createDateKey(a.date).split("-").reverse().join("/")} · ${SHIFT_LABELS[a.shiftType]} — העובד משובץ בזמן חופשה מאושרת.`,
    }));
}

// ─── Combined entry point ─────────────────────────────────────────────────────

export function createWarnings({
  unmetMinimums,
  slots,
  assignments,
  fairnessSummary,
  timeOff,
}: {
  unmetMinimums: UnmetMinimum[];
  slots: EngineSlot[];
  assignments: EngineAssignment[];
  fairnessSummary: Map<string, FairnessSummary>;
  timeOff?: Map<string, Set<string>>;
}): EngineWarning[] {
  return [
    ...createMinimumWarnings(unmetMinimums),
    ...createTimeOffWarnings(assignments, timeOff),
    ...createMandatoryStaffingWarnings(slots, assignments),
    ...createFairnessWarnings(fairnessSummary),
  ];
}
