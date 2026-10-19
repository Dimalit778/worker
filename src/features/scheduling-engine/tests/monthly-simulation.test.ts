import { describe, expect, it } from 'vitest';
import { attachSimulationHistory, monthlySimulationInput, religiousIndexes, offerKey } from '../../../../scripts/scheduling-simulation-fixture';
import { generateSchedule } from '../generate-schedule';
import { collectUnmetMinimums } from '../weekly-minimums';
import { validateAssignments } from '../validate';
import { computeFairnessSummary } from '../fairness';
import { buildSlots, createSlotKey } from '../slots';
import type { EngineAssignment } from '../types';

describe('27 employees across consecutive scheduling periods', () => {
  it('rotates eight restricted weekend workers over both months without losing minimums, roles or rest', () => {
    const history: EngineAssignment[] = [];
    for (let periodIndex = 0; periodIndex < 4; periodIndex++) {
      const input = monthlySimulationInput(1, periodIndex);
      attachSimulationHistory(input, history, periodIndex < 3 ? monthlySimulationInput(1, periodIndex + 1) : undefined);
      const result = generateSchedule(input);
      expect(result.assignments).toHaveLength(270);
      expect(collectUnmetMinimums(input, result.assignments)).toEqual([]);
      expect(validateAssignments(input, result.assignments, { allowManualOverrides: false })).toEqual([]);
      const required = new Map(buildSlots(input).map(s => [createSlotKey(s), s.requiredAmount]));
      for (const [key, amount] of required) expect(result.assignments.filter(a => createSlotKey(a) === key)).toHaveLength(amount);
      for (const index of religiousIndexes) {
        const shifts = result.assignments.filter(a => a.employeeId === input.employees[index].id);
        expect(shifts.some(a => a.date.getUTCDay() === 5)).toBe(false);
        expect(shifts.filter(a => a.date.getUTCDay() === 6).every(a => a.shiftType === 'NIGHT')).toBe(true);
      }
      // On any same-time pair, there must be no avoidable role downgrade.
      for (const a of result.assignments.filter(a => a.positionId === 'controller')) {
        const owner = input.employees.find(e => e.id === a.employeeId)!;
        if (owner.rank !== 2) continue;
        expect(result.assignments.some(b => b.positionId === 'guard' && b.shiftType === a.shiftType &&
          b.date.getTime() === a.date.getTime() && input.employees.find(e => e.id === b.employeeId)?.rank === 3)).toBe(false);
      }
      history.push(...result.assignments);
      if (periodIndex % 2 === 1) {
        const fairness = computeFairnessSummary(history);
        for (const index of religiousIndexes) {
          expect(fairness.get(input.employees[index].id)?.weekendShifts).toBe((periodIndex + 1) / 2);
        }
      }
    }
  }, 15000);

  it.each([2, 8])('keeps constrained and overlapping submissions legal across a month (seed %i)', seed => {
    const history: EngineAssignment[] = [];
    for (let periodIndex = 0; periodIndex < 2; periodIndex++) {
      const input = monthlySimulationInput(seed * 100 + periodIndex, periodIndex, 'mixed');
      attachSimulationHistory(input, history, monthlySimulationInput(seed * 100 + periodIndex + 1, periodIndex + 1, 'mixed'));
      expect(['MORNING', 'EVENING', 'NIGHT'].every(shift => input.availability.get(input.employees[0].id)!.has(
        offerKey(input.week1Dates[0], shift as 'MORNING' | 'EVENING' | 'NIGHT')))).toBe(true);
      const result = generateSchedule(input);
      expect(result.unmetMinimums).toEqual([]);
      expect(validateAssignments(input, result.assignments, { allowManualOverrides: false })).toEqual([]);
      history.push(...result.assignments);
    }
  }, 15000);

  it('preserves locks and reports an impossible morning minimum explicitly', () => {
    const input = monthlySimulationInput(1, 0);
    const employee = input.employees[8];
    input.availability.set(employee.id, new Set(input.week1Dates.filter(d => d.getUTCDay() < 5).map(d => offerKey(d, 'EVENING'))));
    const locked: EngineAssignment = { employeeId: input.employees[0].id, facilityId: input.period.facilityId,
      positionId: 'supervisor', date: input.week1Dates[0], shiftType: 'MORNING', slotIndex: 3, isManualOverride: true };
    input.manualAssignments = [locked];
    const result = generateSchedule(input);
    expect(input.manualAssignments).toEqual([locked]);
    expect(result.unmetMinimums).toContainEqual({ employeeId: employee.id, weekNumber: 1, shiftType: 'MORNING', required: 2, actual: 0 });
    expect(result.assignments.some(a => a.employeeId === employee.id && a.shiftType === 'MORNING')).toBe(false);
    expect(validateAssignments(input, [locked, ...result.assignments], { allowManualOverrides: false })).toEqual([]);
  }, 15000);
});
