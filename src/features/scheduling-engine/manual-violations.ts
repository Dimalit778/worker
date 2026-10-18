import { buildSlots, createDateKey, createSlotKey, findRequiredRank } from './slots';
import { getSlotFillCount, hasShiftConflict, isAvailable, isSameDate } from './constraints';
import { canEmployeeFillPosition } from './role-eligibility';
import type { EngineAssignment, EngineInput } from './types';

export type ManualViolationCode =
  | 'NO_SUBMISSION'
  | 'UNAVAILABLE'
  | 'TIME_OFF'
  | 'DOUBLE_BOOKED'
  | 'REST_GAP'
  | 'RANK_MISMATCH'
  | 'OVER_CAPACITY';

export type ManualViolation = { code: ManualViolationCode; message: string; employeeId: string };

export const MANUAL_VIOLATION_MESSAGES: Record<ManualViolationCode, string> = {
  NO_SUBMISSION: 'העובד לא הגיש זמינות לתקופה',
  UNAVAILABLE: 'העובד סימן שאינו זמין למשמרת',
  TIME_OFF: 'לעובד אושרה חופשה בתאריך זה',
  DOUBLE_BOOKED: 'העובד כבר משובץ באותה משמרת',
  REST_GAP: 'פחות מ־8 שעות מנוחה בין משמרות',
  RANK_MISMATCH: 'דרגת העובד אינה מתאימה לתפקיד',
  OVER_CAPACITY: 'חריגה מכמות העובדים הנדרשת',
};

/**
 * Checks a manual placement. `blocking` rules (facility, active employee, valid slot) can never be
 * overridden; `violations` are business rules a manager may explicitly approve.
 * `others` must contain every other assignment of the schedule, but not `candidate`.
 */
export function computeManualViolations(
  input: EngineInput,
  others: EngineAssignment[],
  candidate: EngineAssignment,
): { blocking: string[]; violations: ManualViolation[] } {
  const employee = input.employees.find(e => e.id === candidate.employeeId);
  const blocking: string[] = [];
  if (!employee || employee.facilityId !== input.period.facilityId || candidate.facilityId !== input.period.facilityId) blocking.push('העובד אינו שייך למתקן');
  else if (!employee.isActive) blocking.push('העובד אינו פעיל');
  if (!Number.isFinite(candidate.date.getTime()) || candidate.date < input.period.startDate || candidate.date > input.period.endDate ||
      findRequiredRank(input, candidate.positionId) === undefined) blocking.push('תפקיד או תאריך אינם תקינים לשיבוץ');
  if (blocking.length || !employee) return { blocking, violations: [] };

  const found = new Set<ManualViolationCode>();
  if (input.timeOff?.get(candidate.employeeId)?.has(createDateKey(candidate.date))) {
    found.add('TIME_OFF');
  } else if (!isAvailable(candidate.employeeId, candidate.date, candidate.shiftType, input.availability)) {
    found.add(input.availability.has(candidate.employeeId) ? 'UNAVAILABLE' : 'NO_SUBMISSION');
  }
  for (const other of [...others, ...(input.boundaryAssignments ?? [])]) {
    if (other.employeeId !== candidate.employeeId || !hasShiftConflict(other.date, other.shiftType, candidate.date, candidate.shiftType)) continue;
    found.add(other.shiftType === candidate.shiftType && isSameDate(other.date, candidate.date) ? 'DOUBLE_BOOKED' : 'REST_GAP');
  }
  const requiredRank = findRequiredRank(input, candidate.positionId);
  if (!canEmployeeFillPosition(employee.rank, requiredRank)) found.add('RANK_MISMATCH');
  const slot = buildSlots(input).find(s => createSlotKey(s) === createSlotKey(candidate));
  if (slot && getSlotFillCount(slot, [...others, candidate]) > slot.requiredAmount) found.add('OVER_CAPACITY');
  return {
    blocking,
    violations: [...found].map(code => ({ code, message: MANUAL_VIOLATION_MESSAGES[code], employeeId: candidate.employeeId })),
  };
}
