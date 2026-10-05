import { describe, expect, it } from 'vitest';
import { planCapacityMoves } from '@/features/schedules/services/capacity-plan';
import { generateSchedule } from '@/features/scheduling-engine/generate-schedule';
import { validateAssignments } from '@/features/scheduling-engine/validate';
import type { EngineCapacity, EngineInput } from '@/features/scheduling-engine/types';

const date = new Date('2026-10-05T00:00:00Z');
const capacities: EngineCapacity[] = [
  { positionId: 'manager', requiredRank: 2, positionName: 'אחמ״ש', shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 },
  { positionId: 'controller', requiredRank: 3, positionName: 'בקר', shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 },
  { positionId: 'guard', requiredRank: 4, positionName: 'מאבטח', shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 },
];
function assigned(id: string, positionId = 'manager', rank = 2, slotNumber = 1) {
  return { id, date, shiftType: 'MORNING' as const, positionId, employeeRank: rank, positionRank: rank, slotNumber, isLocked: false };
}

describe('capacity reconciliation', () => {
  it('keeps one manager and moves the extra manager to controller first', () => {
    expect(planCapacityMoves([assigned('first'), assigned('second', 'manager', 2, 2)], capacities)).toEqual({ moves: [{ id: 'second', positionId: 'controller' }], unplaced: [] });
  });
  it('uses a guard position when the controller position is full', () => {
    expect(planCapacityMoves([assigned('first'), assigned('second', 'manager', 2, 2), assigned('controller', 'controller', 3)], capacities)).toEqual({ moves: [{ id: 'second', positionId: 'guard' }], unplaced: [] });
  });
  it('does not create a slot when every compatible position is full', () => {
    const result = planCapacityMoves([assigned('first'), assigned('second', 'manager', 2, 2), assigned('controller', 'controller', 3), assigned('guard', 'guard', 4)], capacities);
    expect(result).toEqual({ moves: [], unplaced: ['second'] });
  });
  it('never moves a guard into the controller role', () => {
    expect(planCapacityMoves([assigned('first', 'guard', 4), assigned('second', 'guard', 4, 2)], capacities)).toEqual({ moves: [], unplaced: ['second'] });
  });
  it('uses the requirements of the assignment day and shift', () => {
    const friday = new Date('2026-10-09T00:00:00Z');
    const rows = [{ ...assigned('manager'), date: friday }];
    const rules: EngineCapacity[] = [{ ...capacities[2], dayCategory: 'FRIDAY' }];
    expect(planCapacityMoves(rows, rules)).toEqual({ moves: [{ id: 'manager', positionId: 'guard' }], unplaced: [] });
  });
  it('preserves a locked assignment in the original role when possible', () => {
    const rows = [assigned('first'), { ...assigned('second', 'manager', 2, 2), isLocked: true }];
    expect(planCapacityMoves(rows, capacities).moves).toEqual([{ id: 'first', positionId: 'controller' }]);
  });
});

function input(rules: EngineCapacity[]): EngineInput {
  return {
    period: { id: 'schedule', facilityId: 'facility', startDate: date, endDate: date },
    week1Dates: [date], week2Dates: [], capacities: rules,
    employees: ['first', 'second'].map(id => ({ id, facilityId: 'facility', positionId: 'role-manager', rank: 2, isActive: true })),
    availability: new Map(['first', 'second'].map(id => [id, new Set(['2026-10-05|MORNING'])])),
    manualAssignments: [],
  };
}

describe('two available shift managers', () => {
  it('assigns one as manager and the other as controller without exceeding capacity', () => {
    const data = input(capacities);
    const output = generateSchedule(data);
    expect(output.assignments.filter(a => a.positionId === 'manager')).toHaveLength(1);
    expect(output.assignments.filter(a => a.positionId === 'controller')).toHaveLength(1);
    expect(new Set(output.assignments.map(a => a.employeeId)).size).toBe(2);
    expect(validateAssignments(data, output.assignments)).toEqual([]);
  });
  it('assigns the second manager as a guard when there is no controller capacity', () => {
    const data = input(capacities.filter(c => c.positionId !== 'controller'));
    const output = generateSchedule(data);
    expect(output.assignments.filter(a => a.positionId === 'manager')).toHaveLength(1);
    expect(output.assignments.filter(a => a.positionId === 'guard')).toHaveLength(1);
    expect(validateAssignments(data, output.assignments)).toEqual([]);
  });
  it('leaves the second employee unassigned when no other capacity exists', () => {
    const output = generateSchedule(input([capacities[0]]));
    expect(output.assignments).toHaveLength(1);
  });
});
