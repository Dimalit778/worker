import {
  EngineAssignment,
  EngineSlot,
  EngineWarning,
  FairnessSummary,
  UnmetMinimum,
} from "./types";
import { getSlotFillCount } from "./constraints";
import { createDateKey, getDayCategory } from "./slots";

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
    message: `Week ${u.weekNumber}: needs ${u.required} ${u.shiftType} shift(s), has ${u.actual}`,
  }));
}

// ─── Capacity warnings ────────────────────────────────────────────────────────

// UNFILLED/UNDERSTAFFED here means a desired ShiftCapacity target was missed.
// Mandatory business requirements are evaluated separately as ERRORs.
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
        severity: "WARNING",
        positionId: slot.positionId,
        date: slot.date,
        shiftType: slot.shiftType,
        message: `${slot.shiftType} on ${createDateKey(slot.date)}: 0/${slot.requiredAmount} assigned`,
      });
    } else if (fillCount > 0 && fillCount < slot.requiredAmount) {
      warnings.push({
        type: "UNDERSTAFFED",
        severity: "WARNING",
        positionId: slot.positionId,
        date: slot.date,
        shiftType: slot.shiftType,
        message: `${slot.shiftType} on ${createDateKey(slot.date)}: ${fillCount}/${slot.requiredAmount} assigned`,
      });
    }
  }

  return warnings;
}

// ─── Mandatory staffing warnings ─────────────────────────────────────────────

function normalizePositionName(name: string | undefined): string {
  return (name ?? "")
    .replace(/[״"]/g, "")
    .replace(/[׳']/g, "")
    .trim();
}

function isAhmash(name: string | undefined): boolean {
  const normalized = normalizePositionName(name);
  return normalized === "אחמש";
}

function isBakar(name: string | undefined): boolean {
  return normalizePositionName(name) === "בקר";
}

function isGuard(name: string | undefined): boolean {
  return normalizePositionName(name) === "מאבטח";
}

function getAssignmentPositionName(
  assignment: EngineAssignment,
  positionNamesById: Map<string, string | undefined>
): string | undefined {
  return assignment.positionName ?? positionNamesById.get(assignment.positionId);
}

function countAnyAssignmentsForSlot(assignments: EngineAssignment[], slot: EngineSlot): number {
  return assignments.filter(
    (assignment) =>
      assignment.courtId === slot.courtId &&
      assignment.shiftType === slot.shiftType &&
      assignment.date.getTime() === slot.date.getTime()
  ).length;
}

function hasRoleCount(
  assignments: EngineAssignment[],
  slot: EngineSlot,
  positionNamesById: Map<string, string | undefined>,
  predicate: (positionName: string | undefined) => boolean,
  required: number
): boolean {
  const count = assignments.filter((assignment) => {
    if (assignment.courtId !== slot.courtId) return false;
    if (assignment.shiftType !== slot.shiftType) return false;
    if (assignment.date.getTime() !== slot.date.getTime()) return false;
    return predicate(getAssignmentPositionName(assignment, positionNamesById));
  }).length;

  return count >= required;
}

function createMandatoryWarning(slot: EngineSlot, message: string): EngineWarning {
  const [year, month, day] = createDateKey(slot.date).split("-");
  const dateLabel = `${day}/${month}/${year}`;

  return {
    type: "UNFILLED",
    severity: "ERROR",
    date: slot.date,
    shiftType: slot.shiftType,
    message: `${dateLabel} · ${SHIFT_LABELS[slot.shiftType]} — ${message}`,
  };
}

export function createMandatoryStaffingWarnings(
  slots: EngineSlot[],
  assignments: EngineAssignment[]
): EngineWarning[] {
  const warnings: EngineWarning[] = [];
  const representativeSlots = new Map<string, EngineSlot>();
  const positionNamesById = new Map<string, string | undefined>();

  for (const slot of slots) {
    representativeSlots.set(`${slot.courtId}|${createDateKey(slot.date)}|${slot.shiftType}`, slot);
    positionNamesById.set(slot.positionId, slot.positionName);
  }

  for (const assignment of assignments) {
    if (assignment.positionName) {
      positionNamesById.set(assignment.positionId, assignment.positionName);
    }
  }

  for (const slot of representativeSlots.values()) {
    const dayCategory = getDayCategory(slot.date);
    const hasAhmash = hasRoleCount(assignments, slot, positionNamesById, isAhmash, 1);
    const hasBakar = hasRoleCount(assignments, slot, positionNamesById, isBakar, 1);
    const hasGuard = (required: number) =>
      hasRoleCount(assignments, slot, positionNamesById, isGuard, required);
    const hasAny = countAnyAssignmentsForSlot(assignments, slot) > 0;

    if (dayCategory === "WEEKDAY" && slot.shiftType === "MORNING") {
      if (!hasAhmash) warnings.push(createMandatoryWarning(slot, "חסר אחמ״ש"));
      if (!hasBakar) warnings.push(createMandatoryWarning(slot, "חסר בקר"));
      if (!hasGuard(3)) warnings.push(createMandatoryWarning(slot, "חסרים 3 מאבטחים"));
      continue;
    }

    if (dayCategory === "WEEKDAY" && slot.shiftType === "EVENING") {
      if (!hasAhmash && !hasBakar) {
        warnings.push(createMandatoryWarning(slot, "חסר אחמ״ש או בקר"));
      }
      if (!hasGuard(2)) warnings.push(createMandatoryWarning(slot, "חסרים 2 מאבטחים"));
      continue;
    }

    if (dayCategory === "WEEKDAY" && slot.shiftType === "NIGHT") {
      if (!hasAny) warnings.push(createMandatoryWarning(slot, "חסר עובד אחד לפחות"));
      continue;
    }

    if (dayCategory === "FRIDAY" && slot.shiftType === "MORNING") {
      if (!hasAhmash && !hasBakar) {
        warnings.push(createMandatoryWarning(slot, "חסר אחמ״ש או בקר"));
      }
      if (!hasGuard(1)) warnings.push(createMandatoryWarning(slot, "חסר מאבטח"));
      continue;
    }

    if (
      (dayCategory === "FRIDAY" && (slot.shiftType === "EVENING" || slot.shiftType === "NIGHT")) ||
      dayCategory === "SATURDAY"
    ) {
      if (!hasAny) warnings.push(createMandatoryWarning(slot, "חסר עובד אחד לפחות"));
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
    ...createMandatoryStaffingWarnings(slots, assignments),
    ...createCapacityWarnings(slots, assignments),
    ...createFairnessWarnings(fairnessSummary),
  ];
}
