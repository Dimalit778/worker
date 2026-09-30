import { buildSlots, createSlotKey } from './slots';
import { isAvailable, isDoubleBooked, isEligibleForSlot, getSlotFillCount } from './constraints';
import type { EngineAssignment, EngineInput } from './types';

/** Shared by manual edits, generation and publication. Never bypass hard failures. */
export function validateAssignments(input: EngineInput, assignments: EngineAssignment[]): string[] {
  const slots = buildSlots(input);
  const slotMap = new Map(slots.map(slot => [createSlotKey(slot), slot]));
  const employees = new Map(input.employees.map(employee => [employee.id, employee]));
  const errors: string[] = [];
  const accepted = [...(input.boundaryAssignments ?? [])];
  for (const assignment of assignments) {
    const employee = employees.get(assignment.employeeId);
    const slot = slotMap.get(createSlotKey(assignment));
    if (!employee || !slot || !isEligibleForSlot(employee, slot)) {
      errors.push('עובד, תפקיד, מתקן או תאריך אינם תקינים לשיבוץ');
    } else if (!isAvailable(employee.id, assignment.date, assignment.shiftType, input.availability)) {
      errors.push('העובד לא הגיש זמינות למשמרת');
    }
    if (isDoubleBooked(assignment.employeeId, assignment.date, assignment.shiftType, accepted)) {
      errors.push('כפילות או פחות מ־8 שעות מנוחה בין משמרות');
    }
    accepted.push(assignment);
  }
  for (const slot of slots) {
    if (getSlotFillCount(slot, assignments) > slot.requiredAmount) errors.push('חריגה מכמות העובדים הנדרשת');
  }
  return [...new Set(errors)];
}
