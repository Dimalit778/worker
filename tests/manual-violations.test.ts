import { describe, expect, it } from 'vitest';
import { computeManualViolations } from '@/features/scheduling-engine/manual-violations';
import type { EngineAssignment, EngineInput } from '@/features/scheduling-engine/types';

const date = new Date('2026-10-05T00:00:00Z');
const key = '2026-10-05|MORNING';
function input(): EngineInput {
  return {
    scheduleId: 's',
    period: { id: 's', facilityId: 'f', startDate: date, endDate: date },
    week1Dates: [date], week2Dates: [],
    employees: [{ id: 'e', facilityId: 'f', positionId: 'r', rank: 3, isActive: true }],
    capacities: [{ positionId: 'p', requiredRank: 3, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 }],
    availability: new Map([['e', new Set([key])]]),
    manualAssignments: [],
  };
}
const candidate: EngineAssignment = { employeeId: 'e', facilityId: 'f', positionId: 'p', date, shiftType: 'MORNING', slotIndex: 0, isManualOverride: false, source: 'MANUAL' };
const codes = (r: ReturnType<typeof computeManualViolations>) => r.violations.map(v => v.code);

describe('computeManualViolations', () => {
  it('reports approved time off as its own overridable violation', () => {
    const vacation = input(); vacation.timeOff = new Map([['e', new Set(['2026-10-05'])]]); vacation.availability = new Map([['e', new Set()]]);
    expect(codes(computeManualViolations(vacation, [], candidate))).toEqual(['TIME_OFF']);
  });
  it('returns nothing for a valid placement', () => {
    expect(computeManualViolations(input(), [], candidate)).toEqual({ blocking: [], violations: [] });
  });
  it('reports a missing submission and unavailability as overridable', () => {
    const none = input(); none.availability = new Map();
    expect(codes(computeManualViolations(none, [], candidate))).toEqual(['NO_SUBMISSION']);
    const off = input(); off.availability = new Map([['e', new Set<string>()]]);
    expect(codes(computeManualViolations(off, [], candidate))).toEqual(['UNAVAILABLE']);
  });
  it('reports same-shift double booking and capacity but blocks consecutive shifts', () => {
    const data = input();
    const other = { ...candidate, employeeId: 'x', slotIndex: 1 };
    expect(codes(computeManualViolations(data, [{ ...candidate, positionId: 'q' }], candidate))).toContain('DOUBLE_BOOKED');
    expect(computeManualViolations(data, [{ ...candidate, date: new Date('2026-10-04T00:00:00Z'), shiftType: 'NIGHT' }], candidate).blocking).toContain('לא ניתן לשבץ עובד לשתי משמרות מלאות עוקבות');
    expect(codes(computeManualViolations(data, [other], candidate))).toContain('OVER_CAPACITY');
  });
  it('reports a rank mismatch', () => {
    const data = input(); data.employees[0].rank = 4;
    expect(codes(computeManualViolations(data, [], candidate))).toEqual(['RANK_MISMATCH']);
  });
  it('blocks inactive employees, foreign facilities and invalid slots without allowing override', () => {
    const inactive = input(); inactive.employees[0].isActive = false;
    expect(computeManualViolations(inactive, [], candidate).blocking).not.toEqual([]);
    expect(computeManualViolations(input(), [], { ...candidate, employeeId: 'ghost' }).blocking).not.toEqual([]);
    expect(computeManualViolations(input(), [], { ...candidate, facilityId: 'other' }).blocking).not.toEqual([]);
    expect(computeManualViolations(input(), [], { ...candidate, positionId: 'nope' }).blocking).not.toEqual([]);
    expect(computeManualViolations(input(), [], { ...candidate, date: new Date('2026-11-01T00:00:00Z') }).blocking).not.toEqual([]);
  });
});

it('existing manual assignments of an inactive employee do not fail validation of other edits', async () => {
  const { validateAssignments } = await import('@/features/scheduling-engine/validate');
  const data = input(); data.employees[0].isActive = false;
  expect(validateAssignments(data, [candidate])).toEqual([]);
});
