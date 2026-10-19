import { describe, expect, it } from 'vitest';
import { generateSchedule } from '../generate-schedule';
import { collectUnmetMinimums, countWeeklyShifts } from '../weekly-minimums';
import { buildSlots } from '../slots';
import { canAssignEmployeeToSlot, getSlotFillCount } from '../constraints';
import { validateAssignments } from '../validate';
import { analyzeSchedule } from '../../schedules/generation/recalculate';
import type { EngineAssignment, EngineInput, ShiftType } from '../types';

function fixture(days = 7, employeeCount = 3): EngineInput {
  const dates = Array.from({ length: days }, (_, i) => new Date(Date.UTC(2026, 9, 4 + i)));
  const employees = Array.from({ length: employeeCount }, (_, i) => ({
    id: `e${i}`, rank: 4, positionId: 'guard', facilityId: 'f', isActive: true,
  }));
  return {
    scheduleId: 's', period: { id: 's', facilityId: 'f', startDate: dates[0], endDate: dates.at(-1)! },
    week1Dates: dates.slice(0, 7), week2Dates: dates.slice(7), employees,
    availability: new Map(employees.map(e => [e.id, new Set(dates.flatMap(d =>
      (['MORNING', 'EVENING', 'NIGHT'] as const).map(s => key(d, s))))])),
    capacities: (['WEEKDAY', 'FRIDAY', 'SATURDAY'] as const).flatMap(dayCategory =>
      (['MORNING', 'EVENING', 'NIGHT'] as const).map(shiftType => ({
        positionId: 'guard', positionName: 'מאבטח', requiredRank: 4, amount: 1, dayCategory, shiftType,
      }))), manualAssignments: [],
  };
}
const key = (date: Date, shift: ShiftType) => `${date.toISOString().slice(0, 10)}|${shift}`;
const assignment = (employeeId: string, date: Date, shiftType: ShiftType): EngineAssignment => ({
  employeeId, date, shiftType, facilityId: 'f', positionId: 'guard', slotIndex: 0, isManualOverride: true,
});

describe('minimums before extra assignments', () => {
  it.each([7, 14])('finishes all attainable minimums before extras in a %i-day period', days => {
    const input = fixture(days, 2);
    const result = generateSchedule(input);
    const minimumCount = 2 * 3 * (days / 7);
    expect(collectUnmetMinimums(input, result.assignments.slice(0, minimumCount))).toEqual([]);
    expect(result.assignments.slice(0, minimumCount).some(a => a.shiftType === 'NIGHT')).toBe(false);
    expect(result.assignments.length).toBeGreaterThan(minimumCount);
    expect(validateAssignments(input, result.assignments)).toEqual([]);
  });

  it('reserves a limited morning for the employee who cannot work the evening', () => {
    const input = fixture(7, 2);
    const date = input.week1Dates[0];
    input.availability = new Map([
      ['e0', new Set([key(date, 'MORNING'), key(date, 'EVENING')])],
      ['e1', new Set([key(date, 'MORNING')])],
    ]);
    const result = generateSchedule(input);
    expect(result.assignments.map(a => [a.employeeId, a.shiftType])).toEqual([
      ['e1', 'MORNING'], ['e0', 'EVENING'],
    ]);
  });

  it('moves a generated morning to preserve the only available evening minimum', () => {
    const input = fixture(7, 1);
    const [first, second, third] = input.week1Dates;
    input.availability = new Map([['e0', new Set([
      key(first, 'MORNING'), key(second, 'MORNING'), key(third, 'MORNING'), key(first, 'EVENING'),
    ])]]);
    const output = generateSchedule(input);
    expect(output.unmetMinimums).toEqual([]);
    expect(output.assignments.filter(a => a.shiftType === 'MORNING').map(a => a.date)).toEqual([second, third]);
    expect(output.assignments.some(a => a.date === first && a.shiftType === 'EVENING')).toBe(true);
    expect(validateAssignments(input, output.assignments)).toEqual([]);
  });

  it('never moves a locked minimum when attempting an exchange', () => {
    const input = fixture(7, 1);
    const [first, second, third] = input.week1Dates;
    input.manualAssignments = [assignment('e0', first, 'MORNING')];
    input.availability = new Map([['e0', new Set([
      key(first, 'MORNING'), key(second, 'MORNING'), key(third, 'MORNING'), key(first, 'EVENING'),
    ])]]);
    const output = generateSchedule(input);
    expect(output.unmetMinimums).toContainEqual({ employeeId: 'e0', weekNumber: 1, shiftType: 'EVENING', required: 1, actual: 0 });
    expect(output.assignments.some(a => a.date === first && a.shiftType === 'EVENING')).toBe(false);
  });

  it('uses the second morning for the minimum even when its evening is less staffed', () => {
    const input = fixture(7, 2);
    const [first, second, third] = input.week1Dates;
    input.manualAssignments = [assignment('e0', first, 'MORNING'), assignment('e1', second, 'MORNING')];
    input.capacities = input.capacities.map(c => ({ ...c, amount: 2 }));
    input.availability = new Map([['e0', new Set([
      key(second, 'MORNING'), key(second, 'EVENING'), key(third, 'EVENING'),
    ])]]);
    const result = generateSchedule(input);
    expect(result.assignments.filter(a => a.employeeId === 'e0').map(a => [a.date, a.shiftType])).toEqual([
      [second, 'MORNING'], [third, 'EVENING'],
    ]);
  });

  it('evaluates only existing weeks and ignores inactive employees in engine and screen analysis', () => {
    const input = fixture();
    input.employees[2].isActive = false;
    const output = generateSchedule(input);
    expect(output.unmetMinimums.every(u => u.weekNumber === 1 && u.employeeId !== 'e2')).toBe(true);
    const analysis = analyzeSchedule(input, output.assignments);
    expect(analysis.warnings.some(w => w.message.includes('שבוע 2:'))).toBe(false);
    expect(analysis.warnings.some(w => w.type === 'MIN_NOT_MET' && w.employeeId === 'e2')).toBe(false);
  });

  it('does not use a surplus in week one to satisfy week two', () => {
    const input = fixture(14, 1);
    input.availability.set('e0', new Set(input.week1Dates.map(d => key(d, 'MORNING'))));
    const output = generateSchedule(input);
    expect(output.unmetMinimums).toContainEqual({ employeeId: 'e0', weekNumber: 2, shiftType: 'MORNING', required: 2, actual: 0 });
  });

  it('reports minimum counts from the final assignments', () => {
    const input = fixture(14, 8);
    const output = generateSchedule(input);
    expect(output.unmetMinimums).toEqual(collectUnmetMinimums(input, output.assignments));
  });

  it('uses explicit holiday categories consistently in fairness and staffing warnings', () => {
    const input = fixture(7, 1);
    const date = input.week1Dates[0];
    input.holidayCategories = new Map([[date.toISOString().slice(0, 10), 'HOLIDAY']]);
    input.capacities = [{ positionId: 'guard', requiredRank: 4, amount: 1, shiftType: 'MORNING', dayCategory: 'HOLIDAY' }];
    input.availability = new Map([['e0', new Set([key(date, 'MORNING')])]]);
    const output = generateSchedule(input);
    expect(output.fairnessSummary.get('e0')?.weekendShifts).toBe(1);
    expect(output.warnings.filter(w => w.date?.getTime() === date.getTime())).toEqual([]);
  });

  it('keeps generated slot indexes unique after exchanges and sparse locks', () => {
    const input = fixture(7, 3);
    input.capacities = input.capacities.map(c => ({ ...c, amount: 3 }));
    input.manualAssignments = [{ ...assignment('e0', input.week1Dates[0], 'MORNING'), slotIndex: 2 }];
    const output = generateSchedule(input);
    const identifiers = [...input.manualAssignments, ...output.assignments].map(a =>
      `${a.positionId}|${key(a.date, a.shiftType)}|${a.slotIndex}`);
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it('leaves no directly fillable vacancies, including the former 150-of-252 case', () => {
    const input = fixture(14, 50);
    input.employees.forEach(e => { e.rank = 2; });
    input.capacities = input.capacities.flatMap(c => [
      { ...c, positionId: 'senior', requiredRank: 2, amount: 2 }, { ...c, amount: 4 },
    ]);
    const output = generateSchedule(input);
    expect(output.assignments).toHaveLength(252);
    expect(validateAssignments(input, output.assignments)).toEqual([]);
    for (const slot of buildSlots(input)) {
      if (getSlotFillCount(slot, output.assignments) >= slot.requiredAmount) continue;
      expect(input.employees.some(e => canAssignEmployeeToSlot(e, slot, output.assignments, input.availability))).toBe(false);
    }
  });

  it('balances extra nights and extra mornings/evenings among equally available employees', () => {
    const input = fixture(14, 3);
    // Everyone already has their minimum; only extra shifts remain to distribute.
    for (const employee of input.employees) {
      for (const week of [input.week1Dates, input.week2Dates]) {
        input.manualAssignments.push(assignment(employee.id, week[0], 'MORNING'),
          assignment(employee.id, week[1], 'MORNING'), assignment(employee.id, week[2], 'EVENING'));
      }
    }
    input.dateOverrides = [input.week1Dates, input.week2Dates].flatMap(week =>
      [[week[0], 'MORNING'], [week[1], 'MORNING'], [week[2], 'EVENING']].map(([date, shift]) => ({
        date: (date as Date).toISOString().slice(0, 10), shiftType: shift as ShiftType,
        positionId: 'guard', requiredRank: 4, amount: 3,
      })));
    input.availability = new Map(input.employees.map(e => [e.id, new Set(
      [...input.week1Dates.slice(3), ...input.week2Dates.slice(3)].flatMap(d =>
        (['MORNING', 'EVENING', 'NIGHT'] as const).map(s => key(d, s))))]));
    const output = generateSchedule(input);
    for (const shift of ['MORNING', 'EVENING', 'NIGHT'] as const) {
      const counts = input.employees.map(e => output.assignments.filter(a => a.employeeId === e.id && a.shiftType === shift).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      expect(Math.min(...counts)).toBeGreaterThan(0);
    }
  });

  it('retains locked placements and blocks adjacent-period rest conflicts', () => {
    const input = fixture(7, 2);
    input.manualAssignments = [assignment('e0', input.week1Dates[0], 'MORNING')];
    input.boundaryAssignments = [assignment('e1', new Date('2026-10-03T00:00:00Z'), 'NIGHT')];
    const output = generateSchedule(input);
    expect(output.assignments.some(a => a.employeeId === 'e1' && a.date.getTime() === input.week1Dates[0].getTime() && a.shiftType === 'MORNING')).toBe(false);
    expect(validateAssignments(input, [...input.manualAssignments, ...output.assignments], { allowManualOverrides: false })).toEqual([]);
    expect(input.manualAssignments).toHaveLength(1);
    expect(countWeeklyShifts([...input.manualAssignments, ...output.assignments], input).get('e0')?.week1.MORNING).toBeGreaterThanOrEqual(2);
  });
});
