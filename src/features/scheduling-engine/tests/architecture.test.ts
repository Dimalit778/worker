import { describe, expect, it } from 'vitest';
import { generateSchedule } from '../generate-schedule';
import { validateAssignments } from '../validate';
import { canEmployeeFillPosition } from '../role-eligibility';
import { sortCandidatesByScore } from '../scoring';
import { createEmptyFairnessSummary } from '../fairness';
import type { EngineAssignment, EngineInput, EngineSlot } from '../types';
const date = new Date('2098-01-06T00:00:00Z');
const slot: EngineSlot = { facilityId: 'court', positionId: 'role', requiredCapability: 'GUARD', shiftType: 'NIGHT', date, dayCategory: 'WEEKDAY', requiredAmount: 1 };
const employee = (id: string) => ({ id, facilityId: 'court', positionId: 'unrelated-rank', capability: 'GUARD' as const, isActive: true });
const a = employee('a'); const b = employee('b');
const key = '2098-01-06|NIGHT';
function input(): EngineInput {
  return { scheduleId: 's', period: { id: 'p', facilityId: 'court', startDate: date, endDate: date }, employees: [a,b], week1Dates: [date], week2Dates: [], capacities: [{ positionId: 'role', requiredCapability: 'GUARD', shiftType: 'NIGHT', dayCategory: 'WEEKDAY', amount: 1 }], availability: new Map([['a',new Set([key])],['b',new Set([key])]]), preferences: new Map([['a',new Set([key])]]), manualAssignments: [] };
}
const assignment: EngineAssignment = { employeeId: 'a', facilityId: 'court', positionId: 'role', date, shiftType: 'NIGHT', slotIndex: 0, isManualOverride: false };
describe('architecture rules', () => {
  it('uses stable capabilities, never display labels or position identity', () => {
    expect(canEmployeeFillPosition('SHIFT_MANAGER','GUARD')).toBe(true);
    expect(canEmployeeFillPosition('GUARD','CONTROLLER')).toBe(false);
    expect(canEmployeeFillPosition('אחמ״ש','מאבטח')).toBe(false);
    expect(validateAssignments(input(), [assignment])).toEqual([]);
  });
  it('historical nights beat a preference for another night', () => {
    const data = input();
    data.historicalAssignments = [{ ...assignment, date: new Date('2098-01-01T00:00:00Z') }];
    const result = generateSchedule(data);
    expect(result.assignments[0].employeeId).toBe('b');
    expect(result.fairnessSummary.get('b')?.totalShifts).toBe(1);
    expect(result.fairnessSummary.has('a')).toBe(false);
  });
  it('preferences break otherwise equal burdens', () => {
    const preferences = new Map([['b',new Set([key])]]);
    expect(sortCandidatesByScore([a,b],slot,new Map(),preferences)[0].id).toBe('b');
  });
  it('weekend burden applies to weekend slots', () => {
    const summary = createEmptyFairnessSummary('a'); summary.weekendShifts = 3;
    expect(sortCandidatesByScore([a,b],{ ...slot, dayCategory: 'SATURDAY' },new Map([['a',summary]]))[0].id).toBe('b');
  });
  it('preference cannot override unavailability', () => {
    const data = input(); data.availability.delete('a');
    expect(generateSchedule(data).assignments[0].employeeId).toBe('b');
    expect(validateAssignments(data,[assignment]).join('')).toContain('זמינות');
  });
  it('checks the next period boundary without counting those shifts in output', () => {
    const data = input(); data.boundaryAssignments = [{ ...assignment, date: new Date('2098-01-07T00:00:00Z'), shiftType: 'MORNING' }];
    const result = generateSchedule(data);
    expect(result.assignments[0].employeeId).toBe('b');
    expect(result.stats.totalAssignments).toBe(1);
    expect(validateAssignments(data,[assignment]).join('')).toContain('מנוחה');
  });
  it('does not accept over-capacity or invalid dates from a manual writer', () => {
    expect(validateAssignments(input(),[assignment,{...assignment, employeeId:'b'}]).join('')).toContain('כמות');
    expect(validateAssignments(input(),[{...assignment,date:new Date('2098-02-01T00:00:00Z')}]).join('')).toContain('תקינים');
  });
});
