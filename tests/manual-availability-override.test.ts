import { expect, it } from 'vitest';
import { validateAssignments } from '@/features/scheduling-engine/validate';
import { generateSchedule } from '@/features/scheduling-engine/generate-schedule';
import type { EngineAssignment, EngineInput } from '@/features/scheduling-engine/types';

const date = new Date('2026-10-05T00:00:00Z');
function input(): EngineInput {
  return {
    period: { id: 'schedule', facilityId: 'facility', startDate: date, endDate: date },
    week1Dates: [date], week2Dates: [],
    employees: ['employee', 'other'].map(id => ({ id, facilityId: 'facility', positionId: 'role', rank: 2, isActive: true })),
    capacities: [{ positionId: 'position', requiredRank: 2, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 }],
    availability: new Map(), manualAssignments: [],
  };
}
const manual: EngineAssignment = {
  employeeId: 'employee', facilityId: 'facility', positionId: 'position', date,
  shiftType: 'MORNING', slotIndex: 0, isManualOverride: false, source: 'MANUAL',
};

it('allows a manager assignment without a submitted availability form or a lock', () => {
  expect(validateAssignments(input(), [manual])).toEqual([]);
});
it('allows a manager assignment even when the employee did not offer that shift', () => {
  const data = input();
  data.availability.set('employee', new Set(['2026-10-05|EVENING']));
  expect(validateAssignments(data, [manual])).toEqual([]);
});
it('still rejects an automatic assignment outside submitted availability even when locked', () => {
  expect(validateAssignments(input(), [{ ...manual, source: 'AUTOMATIC', isManualOverride: true }])).toContain('העובד לא הגיש זמינות למשמרת');
});
it('automatic generation still leaves unavailable employees unassigned', () => {
  expect(generateSchedule(input()).assignments).toEqual([]);
});
it('allows manager assignments regardless of configured headcount', () => {
  expect(validateAssignments(input(), [manual, { ...manual, employeeId: 'other', slotIndex: 1 }])).toEqual([]);
});
it('allows the manager to deliberately assign an employee twice', () => {
  expect(validateAssignments(input(), [manual, manual])).toEqual([]);
});
it('allows any role chosen by the manager but keeps facility ownership intact', () => {
  const data = input();
  data.employees[0].rank = 4;
  expect(validateAssignments(data, [manual])).toEqual([]);
  expect(validateAssignments(input(), [{ ...manual, facilityId: 'other-facility' }])).toContain('עובד, תפקיד, מתקן או תאריך אינם תקינים לשיבוץ');
});
it('still rejects a manual assignment outside the schedule period', () => {
  expect(validateAssignments(input(), [{ ...manual, date: new Date('2026-11-01T00:00:00Z') }])).toContain('עובד, תפקיד, מתקן או תאריך אינם תקינים לשיבוץ');
});

it('allows manager assignments in adjacent shifts without imposing a rest rule', () => {
  expect(validateAssignments(input(), [manual, { ...manual, shiftType: 'EVENING' }])).toEqual([]);
});
it('does not invalidate an original automatic shift because of a new manual override', () => {
  const data = input();
  data.availability.set('employee', new Set(['2026-10-05|MORNING']));
  const automatic = { ...manual, source: 'AUTOMATIC' as const };
  expect(validateAssignments(data, [manual, automatic])).toEqual([]);
});
it('strict automatic validation still applies every rule even to a locked manual origin', () => {
  const options = { allowManualOverrides: false };
  expect(validateAssignments(input(), [manual], options)).toContain('העובד לא הגיש זמינות למשמרת');
  const data = input();
  data.availability.set('employee', new Set(['2026-10-05|MORNING']));
  expect(validateAssignments(data, [manual, manual], options)).toContain('כפילות או פחות מ־8 שעות מנוחה בין משמרות');
  expect(validateAssignments(data, [manual, { ...manual, employeeId: 'other' }], options)).toContain('חריגה מכמות העובדים הנדרשת');
  data.employees[0].rank = 4;
  expect(validateAssignments(data, [manual], options)).toContain('עובד, תפקיד, מתקן או תאריך אינם תקינים לשיבוץ');
});
