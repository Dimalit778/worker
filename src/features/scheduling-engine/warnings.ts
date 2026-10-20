import {
  EngineAssignment,
  EngineDateOverride,
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

// ─── Capacity warnings ────────────────────────────────────────────────────────

// UNFILLED/UNDERSTAFFED here means a desired StaffingRequirement target was missed.
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
        message: `${createDateKey(slot.date).split("-").reverse().join("/")} · ${SHIFT_LABELS[slot.shiftType]} — אין עובדים משובצים; התקן הנדרש: ${slot.requiredAmount}.`,
      });
    } else if (fillCount > 0 && fillCount < slot.requiredAmount) {
      warnings.push({
        type: "UNDERSTAFFED",
        severity: "WARNING",
        positionId: slot.positionId,
        date: slot.date,
        shiftType: slot.shiftType,
        message: `${createDateKey(slot.date).split("-").reverse().join("/")} · ${SHIFT_LABELS[slot.shiftType]} — משובצים ${fillCount} מתוך ${slot.requiredAmount} עובדים נדרשים.`,
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
      assignment.facilityId === slot.facilityId &&
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
    if (assignment.facilityId !== slot.facilityId) return false;
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

function guardsMessage(required: number): string {
  return required === 1 ? "חסר מאבטח" : `חסרים ${required} מאבטחים`;
}

// Fixed business minimums per day category. On a date/shift with a date override,
// the manager's explicit requirement caps each minimum (0 = not required that day).
export function createMandatoryStaffingWarnings(
  slots: EngineSlot[],
  assignments: EngineAssignment[],
  dateOverrides: EngineDateOverride[] = []
): EngineWarning[] {
  const warnings: EngineWarning[] = [];
  const shiftSlots = new Map<string, EngineSlot[]>();
  const positionNamesById = new Map<string, string | undefined>();
  const overriddenShifts = new Set(dateOverrides.map((o) => `${o.date}|${o.shiftType}`));

  for (const slot of slots) {
    const key = `${slot.facilityId}|${createDateKey(slot.date)}|${slot.shiftType}`;
    shiftSlots.set(key, [...(shiftSlots.get(key) ?? []), slot]);
    positionNamesById.set(slot.positionId, slot.positionName);
  }

  for (const assignment of assignments) {
    if (assignment.positionName) {
      positionNamesById.set(assignment.positionId, assignment.positionName);
    }
  }

  for (const group of shiftSlots.values()) {
    const slot = group[0];
    const dayCategory = slot.dayCategory;
    const overridden = overriddenShifts.has(`${createDateKey(slot.date)}|${slot.shiftType}`);
    const configured = (predicate: (positionName: string | undefined) => boolean) =>
      group.filter((s) => predicate(s.positionName)).reduce((sum, s) => sum + s.requiredAmount, 0);
    const need = (hard: number, predicate: (positionName: string | undefined) => boolean) =>
      overridden ? Math.min(hard, configured(predicate)) : hard;
    const needAhmashOrBakar = !overridden || configured(isAhmash) + configured(isBakar) > 0;
    const hasAhmash = hasRoleCount(assignments, slot, positionNamesById, isAhmash, 1);
    const hasBakar = hasRoleCount(assignments, slot, positionNamesById, isBakar, 1);
    const hasGuard = (required: number) =>
      hasRoleCount(assignments, slot, positionNamesById, isGuard, required);
    const hasAny = countAnyAssignmentsForSlot(assignments, slot) > 0;

    if (dayCategory === "WEEKDAY" && slot.shiftType === "MORNING") {
      if (need(1, isAhmash) > 0 && !hasAhmash) warnings.push(createMandatoryWarning(slot, "חסר אחמ״ש"));
      if (need(1, isBakar) > 0 && !hasBakar) warnings.push(createMandatoryWarning(slot, "חסר בקר"));
      const guards = need(3, isGuard);
      if (guards > 0 && !hasGuard(guards)) warnings.push(createMandatoryWarning(slot, guardsMessage(guards)));
      continue;
    }

    if (dayCategory === "WEEKDAY" && slot.shiftType === "EVENING") {
      if (needAhmashOrBakar && !hasAhmash && !hasBakar) {
        warnings.push(createMandatoryWarning(slot, "חסר אחמ״ש או בקר"));
      }
      const guards = need(2, isGuard);
      if (guards > 0 && !hasGuard(guards)) warnings.push(createMandatoryWarning(slot, guardsMessage(guards)));
      continue;
    }

    if (dayCategory === "WEEKDAY" && slot.shiftType === "NIGHT") {
      if (!hasAny) warnings.push(createMandatoryWarning(slot, "חסר עובד אחד לפחות"));
      continue;
    }

    if (dayCategory === "FRIDAY" && slot.shiftType === "MORNING") {
      if (needAhmashOrBakar && !hasAhmash && !hasBakar) {
        warnings.push(createMandatoryWarning(slot, "חסר אחמ״ש או בקר"));
      }
      const guards = need(1, isGuard);
      if (guards > 0 && !hasGuard(guards)) warnings.push(createMandatoryWarning(slot, guardsMessage(guards)));
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
  dateOverrides,
  timeOff,
}: {
  unmetMinimums: UnmetMinimum[];
  slots: EngineSlot[];
  assignments: EngineAssignment[];
  fairnessSummary: Map<string, FairnessSummary>;
  dateOverrides?: EngineDateOverride[];
  timeOff?: Map<string, Set<string>>;
}): EngineWarning[] {
  return [
    ...createMinimumWarnings(unmetMinimums),
    ...createTimeOffWarnings(assignments, timeOff),
    ...createMandatoryStaffingWarnings(slots, assignments, dateOverrides),
    ...createCapacityWarnings(slots, assignments),
    ...createFairnessWarnings(fairnessSummary),
  ];
}
