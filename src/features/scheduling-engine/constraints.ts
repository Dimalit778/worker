import { EngineAssignment, EngineEmployee, EngineSlot, ShiftType } from "./types";
import { createDateKey } from "./slots";
import { canEmployeeFillPosition } from "./role-eligibility";

// ─── Date utilities ───────────────────────────────────────────────────────────

// Compares two dates by UTC year/month/day only (ignores time).
export function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// Returns a new Date offset by N days (UTC-safe). Does not mutate input.
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// ─── Hard constraint checkers ─────────────────────────────────────────────────

// H1 — Employee submitted availability for this exact date + shiftType.
// Availability map key format: "YYYY-MM-DD|MORNING" (matches EngineInput definition).
export function isAvailable(
  employeeId: string,
  date: Date,
  shiftType: ShiftType,
  availability: Map<string, Set<string>>
): boolean {
  const key = `${createDateKey(date)}|${shiftType}`;
  return availability.get(employeeId)?.has(key) ?? false;
}

// H2 — Employee already has an assignment on the same or adjacent shift.
export function areAdjacentShifts(
  firstDate: Date,
  firstShiftType: ShiftType,
  secondDate: Date,
  secondShiftType: ShiftType
): boolean {
  if (isSameDate(firstDate, secondDate)) {
    return (
      (firstShiftType === "MORNING" && secondShiftType === "EVENING") ||
      (firstShiftType === "EVENING" && secondShiftType === "MORNING") ||
      (firstShiftType === "EVENING" && secondShiftType === "NIGHT") ||
      (firstShiftType === "NIGHT" && secondShiftType === "EVENING")
    );
  }

  return (
    (firstShiftType === "NIGHT" &&
      secondShiftType === "MORNING" &&
      isSameDate(addDays(firstDate, 1), secondDate)) ||
    (firstShiftType === "MORNING" &&
      secondShiftType === "NIGHT" &&
      isSameDate(addDays(secondDate, 1), firstDate))
  );
}

export function hasShiftConflict(
  firstDate: Date,
  firstShiftType: ShiftType,
  secondDate: Date,
  secondShiftType: ShiftType
): boolean {
  return (
    (firstShiftType === secondShiftType && isSameDate(firstDate, secondDate)) ||
    areAdjacentShifts(firstDate, firstShiftType, secondDate, secondShiftType)
  );
}

export function isDoubleBooked(
  employeeId: string,
  date: Date,
  shiftType: ShiftType,
  assignments: EngineAssignment[]
): boolean {
  return assignments.some(
    (a) =>
      a.employeeId === employeeId &&
      hasShiftConflict(a.date, a.shiftType, date, shiftType)
  );
}

// H3 — Rest rule: NIGHT → next day MORNING is forbidden (and the inverse).
// Checks both directions so callers don't need to think about ordering:
// - Assigning MORNING on date D: blocked if employee has NIGHT on D-1.
// - Assigning NIGHT on date D: blocked if employee has MORNING on D+1.
export function violatesRestRule(
  employeeId: string,
  date: Date,
  shiftType: ShiftType,
  assignments: EngineAssignment[]
): boolean {
  if (shiftType === "MORNING") {
    const dayBefore = addDays(date, -1);
    return assignments.some(
      (a) =>
        a.employeeId === employeeId &&
        a.shiftType === "NIGHT" &&
        isSameDate(a.date, dayBefore)
    );
  }

  if (shiftType === "NIGHT") {
    const dayAfter = addDays(date, 1);
    return assignments.some(
      (a) =>
        a.employeeId === employeeId &&
        a.shiftType === "MORNING" &&
        isSameDate(a.date, dayAfter)
    );
  }

  return false;
}

// H4 + H5 + H7 — Employee belongs to the same court, has the required position,
// and is active.
export function isEligibleForSlot(
  employee: EngineEmployee,
  slot: EngineSlot
): boolean {
  return (
    employee.isActive &&
    employee.courtId === slot.courtId &&
    (employee.positionId === slot.positionId ||
      canEmployeeFillPosition(employee.positionName, slot.positionName))
  );
}

// H6 — Count how many assignments currently fill a slot (by positionId + date +
// shiftType + courtId). Used both to enforce capacity and to track overflow.
export function getSlotFillCount(
  slot: EngineSlot,
  assignments: EngineAssignment[]
): number {
  return assignments.filter(
    (a) =>
      a.courtId === slot.courtId &&
      a.positionId === slot.positionId &&
      a.shiftType === slot.shiftType &&
      isSameDate(a.date, slot.date)
  ).length;
}

// Counts all people already assigned to a court/date/shift, across positions.
// Used when an employee offered two adjacent shifts and should go to the one
// with fewer people.
export function getShiftFillCount(
  slot: EngineSlot,
  assignments: EngineAssignment[]
): number {
  return assignments.filter(
    (a) =>
      a.courtId === slot.courtId &&
      a.shiftType === slot.shiftType &&
      isSameDate(a.date, slot.date)
  ).length;
}

// H6 — Slot has room for at least one more assignment.
export function slotHasCapacity(
  slot: EngineSlot,
  assignments: EngineAssignment[]
): boolean {
  return getSlotFillCount(slot, assignments) < slot.requiredAmount;
}

export function hasAdjacentAvailableSlotWithLowerFill(
  employee: EngineEmployee,
  slot: EngineSlot,
  allSlots: EngineSlot[],
  assignments: EngineAssignment[],
  availability: Map<string, Set<string>>
): boolean {
  const currentShiftFill = getShiftFillCount(slot, assignments);

  return allSlots.some((candidate) => {
    if (candidate.courtId !== slot.courtId) return false;
    if (!areAdjacentShifts(slot.date, slot.shiftType, candidate.date, candidate.shiftType)) {
      return false;
    }
    if (!isEligibleForSlot(employee, candidate)) return false;
    if (!isAvailable(employee.id, candidate.date, candidate.shiftType, availability)) return false;
    if (isDoubleBooked(employee.id, candidate.date, candidate.shiftType, assignments)) {
      return false;
    }
    if (!slotHasCapacity(candidate, assignments)) return false;

    return getShiftFillCount(candidate, assignments) < currentShiftFill;
  });
}

// ─── Combined gate ────────────────────────────────────────────────────────────

// Returns true only when all hard constraints pass. Used by both Phase 1 and
// Phase 2 before any assignment is made.
export function canAssignEmployeeToSlot(
  employee: EngineEmployee,
  slot: EngineSlot,
  assignments: EngineAssignment[],
  availability: Map<string, Set<string>>,
  allSlots?: EngineSlot[]
): boolean {
  return (
    isEligibleForSlot(employee, slot) &&
    isAvailable(employee.id, slot.date, slot.shiftType, availability) &&
    !isDoubleBooked(employee.id, slot.date, slot.shiftType, assignments) &&
    !violatesRestRule(employee.id, slot.date, slot.shiftType, assignments) &&
    slotHasCapacity(slot, assignments) &&
    (!allSlots ||
      !hasAdjacentAvailableSlotWithLowerFill(
        employee,
        slot,
        allSlots,
        assignments,
        availability
      ))
  );
}
