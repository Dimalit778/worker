import type { EngineAssignment, EngineCapacity, EngineInput, ShiftType } from '../src/features/scheduling-engine/types';

export const shifts = ['MORNING', 'EVENING', 'NIGHT'] as const;
export const offerKey = (date: Date, shift: ShiftType) => `${date.toISOString().slice(0, 10)}|${shift}`;

/** Synthetic data only. Weekday role requirements are INCLUDED in total headcount.
 * A rank-3 night slot accepts either a controller or a supervisor, per existing rules.
 * Weekend headcounts are guard slots: no weekend role minimum was requested.
 */
export function simulationInput(count: number, seed = 1, mode: 'full' | 'mixed' | 'minimum' = 'mixed', startOffset = 0): EngineInput {
  let state = seed;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const dates = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + startOffset + i)));
  const employees = Array.from({ length: count }, (_, i) => ({
    id: `employee-${String(i + 1).padStart(2, '0')}`, facilityId: 'simulation', isActive: true,
    rank: i < 4 ? 2 : i < 8 ? 3 : 4,
    positionId: i < 4 ? 'supervisor' : i < 8 ? 'controller' : 'guard',
    positionName: i < 4 ? 'אחמ״ש' : i < 8 ? 'בקר' : 'מאבטח',
  }));
  const capacities: EngineCapacity[] = [];
  for (const dayCategory of ['WEEKDAY', 'FRIDAY', 'SATURDAY'] as const) {
    const amounts = dayCategory === 'WEEKDAY' ? [15, 6, 3] : dayCategory === 'FRIDAY' ? [4, 2, 3] : [2, 2, 2];
    shifts.forEach((shiftType, i) => {
      const supervisor = dayCategory === 'WEEKDAY' && shiftType !== 'NIGHT' ? 1 : 0;
      const controller = dayCategory === 'WEEKDAY' ? 1 : 0;
      for (const [positionId, positionName, requiredRank, amount] of [
        ['supervisor', 'אחמ״ש', 2, supervisor], ['controller', 'בקר', 3, controller],
        ['guard', 'מאבטח', 4, amounts[i] - supervisor - controller],
      ] as const) capacities.push({ dayCategory, shiftType, positionId, positionName, requiredRank, amount });
    });
  }
  const availability = new Map<string, Set<string>>();
  employees.forEach((employee, i) => {
    const offers = new Set<string>();
    for (const offset of [0, 7]) {
      offers.add(offerKey(dates[offset + i % 5], 'MORNING'));
      offers.add(offerKey(dates[offset + (i + 2) % 5], 'MORNING'));
      offers.add(offerKey(dates[offset + (i + 4) % 5], 'EVENING'));
    }
    if (mode !== 'minimum') for (const date of dates) for (const shift of shifts) {
      if (mode === 'full' || random() < (employee.rank < 4 ? 0.85 : 0.65)) offers.add(offerKey(date, shift));
    }
    availability.set(employee.id, offers);
  });
  // Explicit overlaps, including morning + evening + night on the same date.
  if (mode !== 'minimum') {
    shifts.forEach(shift => availability.get(employees[0].id)!.add(offerKey(dates[0], shift)));
    (['MORNING', 'EVENING'] as const).forEach(shift => availability.get(employees[1].id)!.add(offerKey(dates[1], shift)));
  }
  return {
    period: { id: 'simulation', facilityId: 'simulation', startDate: dates[0], endDate: dates[13] },
    scheduleId: 'simulation', week1Dates: dates.slice(0, 7), week2Dates: dates.slice(7),
    employees, capacities, availability, manualAssignments: [],
  };
}

/** Two supervisors, two controllers, and four guards; religion is simulated
 * through submitted availability, never by bypassing normal engine checks. */
export const religiousIndexes = [0, 1, 4, 5, 8, 9, 10, 11];
export function monthlySimulationInput(seed: number, periodIndex: number, mode: 'full' | 'mixed' = 'full') {
  const input = simulationInput(27, seed, mode, periodIndex * 14);
  for (const index of religiousIndexes) {
    const id = input.employees[index].id;
    input.availability.set(id, new Set([...input.availability.get(id)!].filter(key => {
      const day = new Date(`${key.slice(0, 10)}T00:00:00Z`).getUTCDay();
      return day !== 5 && (day !== 6 || key.endsWith('|NIGHT'));
    })));
  }
  return input;
}

/** Both submissions are known up front. An offered first-Sunday morning is
 * mandatory when it is one of only two morning dates in the following week.
 * Pass that future obligation through the engine's existing boundary gate.
 * These boundary guards are constraints, not counted as generated assignments.
 */
export function attachSimulationHistory(input: EngineInput, history: EngineAssignment[], next?: EngineInput) {
  input.historicalAssignments = [...history];
  input.boundaryAssignments = history.filter(a => a.date.getTime() === input.period.startDate.getTime() - 86400000);
  if (!next) return;
  for (const employee of next.employees) {
    const mornings = next.week1Dates.filter(d => next.availability.get(employee.id)?.has(offerKey(d, 'MORNING')));
    if (mornings.length <= 2 && mornings.some(d => d.getTime() === next.period.startDate.getTime())) {
      input.boundaryAssignments.push({ employeeId: employee.id, facilityId: employee.facilityId,
        positionId: employee.positionId, date: next.period.startDate, shiftType: 'MORNING', slotIndex: 0, isManualOverride: true });
    }
  }
}
