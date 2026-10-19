import { writeFileSync } from 'node:fs';
import { generateSchedule } from '../src/features/scheduling-engine/generate-schedule';
import { computeFairnessSummary } from '../src/features/scheduling-engine/fairness';
import { buildSlots, createDateKey } from '../src/features/scheduling-engine/slots';
import { validateAssignments } from '../src/features/scheduling-engine/validate';
import { getSlotFillCount } from '../src/features/scheduling-engine/constraints';
import type { EngineAssignment } from '../src/features/scheduling-engine/types';
import { attachSimulationHistory, monthlySimulationInput, religiousIndexes } from './scheduling-simulation-fixture';

const results = [];
for (const mode of ['full', 'mixed'] as const) {
  for (let seed = 1; seed <= (mode === 'full' ? 1 : 10); seed++) {
    const history: EngineAssignment[] = [];
    const periods = [];
    for (let periodIndex = 0; periodIndex < 4; periodIndex++) {
      const input = monthlySimulationInput(seed * 100 + periodIndex, periodIndex, mode);
      const next = periodIndex < 3 ? monthlySimulationInput(seed * 100 + periodIndex + 1, periodIndex + 1, mode) : undefined;
      attachSimulationHistory(input, history, next);
      const output = generateSchedule(input);
      const errors = validateAssignments(input, output.assignments, { allowManualOverrides: false });
      const vacancies = buildSlots(input).flatMap(slot => {
        const missing = slot.requiredAmount - getSlotFillCount(slot, output.assignments);
        return missing > 0 ? [{ ...slot, missing }] : [];
      });
      history.push(...output.assignments);
      const cumulative = computeFairnessSummary(history);
      const month = computeFairnessSummary(history.filter(a => a.date >= new Date(Date.UTC(2026, 10, 1 + Math.floor(periodIndex / 2) * 28))));
      const rows = input.employees.map((employee, i) => ({ ...employee, religious: religiousIndexes.includes(i),
        current: output.fairnessSummary.get(employee.id), cumulative: cumulative.get(employee.id), month: month.get(employee.id),
        ownRole: output.assignments.filter(a => a.employeeId === employee.id && a.positionId === employee.positionId).length,
      }));
      const ranges = Object.fromEntries(['totalShifts', 'morningShifts', 'eveningShifts', 'nightShifts', 'weekendShifts'].map(field => {
        const values = rows.map(row => (row.cumulative as unknown as Record<string, number>)?.[field] ?? 0);
        return [field, [Math.min(...values), Math.max(...values)]];
      }));
      periods.push({ periodIndex, start: createDateKey(input.period.startDate), end: createDateKey(input.period.endDate),
        filled: output.assignments.length, missing: vacancies.reduce((n, v) => n + v.missing, 0), unmet: output.unmetMinimums.length,
        errors, ranges, rows, vacancies, assignments: output.assignments, unmetMinimums: output.unmetMinimums,
        offers: Object.fromEntries([...input.availability].map(([id, offers]) => [id, [...offers]])), durationMs: output.stats.durationMs });
    }
    results.push({ mode, seed, periods });
    console.log(JSON.stringify({ mode, seed, periods: periods.map(({ filled, missing, unmet, errors, ranges, durationMs }) =>
      ({ filled, missing, unmet, errors: errors.length, ranges, durationMs })) }));
  }
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(results, null, 2));
if (results.some(result => result.periods.some(period => period.errors.length))) process.exitCode = 1;
