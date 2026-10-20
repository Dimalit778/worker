import { describe, expect, it } from 'vitest';
import { repairMinimum } from '../minimum-repair';
import { buildSlots } from '../slots';
import { validateAssignments } from '../validate';
import { countWeeklyShifts } from '../weekly-minimums';
import type { EngineAssignment, EngineInput, ShiftType } from '../types';

function chain() {
  const dates = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 4 + i)));
  const employees = Array.from({ length: 5 }, (_, i) => ({
    id: `e${i}`, rank: 4, facilityId: 'f', positionId: 'guard', isActive: true,
  }));
  const key = (date: Date, shift: ShiftType) => `${date.toISOString().slice(0, 10)}|${shift}`;
  const input: EngineInput = {
    scheduleId: 's', period: { id: 's', facilityId: 'f', startDate: dates[0], endDate: dates[6] },
    week1Dates: dates, week2Dates: [], employees, manualAssignments: [],
    availability: new Map(employees.map((employee, i) => [employee.id,
      new Set([key(dates[i], 'MORNING'), key(dates[i + 1], 'MORNING')])])),
    capacities: (['WEEKDAY', 'FRIDAY', 'SATURDAY'] as const).flatMap(dayCategory =>
      (['MORNING', 'EVENING'] as const).map(shiftType => ({
        positionId: 'guard', requiredRank: 4, amount: 1, dayCategory, shiftType,
      }))),
  };
  input.availability.get('e0')!.add(key(dates[0], 'EVENING'));
  const assignments: EngineAssignment[] = employees.map((employee, i) => ({
    employeeId: employee.id, facilityId: 'f', positionId: 'guard', date: dates[i],
    shiftType: 'MORNING', slotIndex: 0, isManualOverride: false,
  }));
  const slots = buildSlots(input);
  const targets = slots.filter(slot => slot.date === dates[0] && slot.shiftType === 'EVENING');
  return { input, assignments, slots, targets, dates };
}

describe('complete minimum exchange chains', () => {
  it('relocates five earlier minimums without losing any employee weekly shift count', () => {
    const { input, assignments, slots, targets } = chain();
    const before = structuredClone(assignments);
    const result = repairMinimum(input, slots, assignments, input.employees[0], targets);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(assignments.length + 1);
    expect(validateAssignments(input, result!, { allowManualOverrides: false })).toEqual([]);
    const weekly = countWeeklyShifts(result!, input);
    for (const employee of input.employees) expect(weekly.get(employee.id)?.week1.MORNING).toBe(1);
    expect(weekly.get('e0')?.week1.EVENING).toBe(1);
    expect(assignments).toEqual(before);
  });

  it('returns no partial exchange if a locked assignment blocks the chain', () => {
    const { input, assignments, slots, targets } = chain();
    input.manualAssignments = [assignments[3]];
    const before = structuredClone(assignments);
    expect(repairMinimum(input, slots, assignments, input.employees[0], targets)).toBeNull();
    expect(assignments).toEqual(before);
  });

  it('restores both a rest blocker and a capacity blocker before accepting a placement', () => {
    const { input, assignments, slots, targets, dates } = chain();
    const existing: EngineAssignment[] = [assignments[0], { ...assignments[1], date: dates[0], shiftType: 'EVENING' }];
    input.availability.get('e1')!.add(`${dates[0].toISOString().slice(0, 10)}|EVENING`);
    input.availability.get('e1')!.add(`${dates[1].toISOString().slice(0, 10)}|EVENING`);
    const result = repairMinimum(input, slots, existing, input.employees[0], targets);
    expect(result).toHaveLength(3);
    expect(validateAssignments(input, result!, { allowManualOverrides: false })).toEqual([]);
    expect(result!.filter(a => a.employeeId === 'e1' && a.shiftType === 'EVENING')).toHaveLength(1);
    expect(result!.filter(a => a.employeeId === 'e0' && a.shiftType === 'MORNING')).toHaveLength(1);
  });

  it('keeps the requested shift in the search while later exchanges revisit earlier choices', () => {
    const { input, assignments, slots, targets, dates } = chain();
    const key = (day: number, shift: ShiftType) => `${dates[day].toISOString().slice(0, 10)}|${shift}`;
    input.availability = new Map([
      ['e0', new Set([key(0, 'MORNING'), key(1, 'MORNING'), key(3, 'MORNING'), key(0, 'EVENING')])],
      ['e1', new Set([key(0, 'EVENING'), key(2, 'EVENING'), key(2, 'MORNING'), key(1, 'MORNING')])],
    ]);
    const existing: EngineAssignment[] = [assignments[0],
      { ...assignments[1], date: dates[0], shiftType: 'EVENING' },
      { ...assignments[1], date: dates[2], shiftType: 'MORNING' },
    ];
    const result = repairMinimum(input, slots, existing, input.employees[0], targets);
    expect(result).toHaveLength(4);
    expect(validateAssignments(input, result!, { allowManualOverrides: false })).toEqual([]);
    expect(result!.some(a => a.employeeId === 'e0' && a.date === dates[0] && a.shiftType === 'EVENING')).toBe(true);
    expect(result!.some(a => a.employeeId === 'e0' && a.date === dates[3] && a.shiftType === 'MORNING')).toBe(true);
  });
});
