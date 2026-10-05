import { buildSlots, createSlotKey } from './slots';
import { isAvailable, isDoubleBooked, isEligibleForSlot, getSlotFillCount } from './constraints';
import type { EngineAssignment, EngineInput } from './types';

/** Automatic scheduling enforces all rules; persisted manager edits override staffing rules. */
export function validateAssignments(
  input: EngineInput,
  assignments: EngineAssignment[],
  options: { allowManualOverrides?: boolean } = {},
): string[] {
  const allowManualOverrides = options.allowManualOverrides ?? true;
  const isManual = (assignment: EngineAssignment) => allowManualOverrides && assignment.source === 'MANUAL';
  const slots = buildSlots(input);
  const slotMap = new Map(slots.map(slot => [createSlotKey(slot), slot]));
  const employees = new Map(input.employees.map(employee => [employee.id, employee]));
  const errors: string[] = [];
  const accepted = (input.boundaryAssignments ?? []).filter(assignment => !isManual(assignment));
  for (const assignment of assignments) {
    const employee = employees.get(assignment.employeeId);
    if (isManual(assignment)) {
      // Keep data ownership and the schedule's date range intact, without applying staffing rules.
      if (!employee || !employee.isActive || employee.facilityId !== input.period.facilityId ||
          assignment.facilityId !== input.period.facilityId ||
          assignment.date < input.period.startDate || assignment.date > input.period.endDate ||
          !Number.isFinite(assignment.date.getTime()) ||
          !input.capacities.some(capacity => capacity.positionId === assignment.positionId) ||
          !['MORNING', 'EVENING', 'NIGHT'].includes(assignment.shiftType)) {
        errors.push('עובד, תפקיד, מתקן או תאריך אינם תקינים לשיבוץ');
      }
      continue;
    }
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
  const constrainedAssignments = assignments.filter(assignment => !isManual(assignment));
  for (const slot of slots) {
    if (getSlotFillCount(slot, constrainedAssignments) > slot.requiredAmount) errors.push('חריגה מכמות העובדים הנדרשת');
  }
  return [...new Set(errors)];
}
