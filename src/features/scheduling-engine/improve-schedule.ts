import { canAssignEmployeeToSlot, getSlotFillCount, hasShiftConflict, isAvailable, isEligibleForSlot } from './constraints';
import { computeFairnessSummary, createEmptyFairnessSummary } from './fairness';
import { repairMinimum } from './minimum-repair';
import { createDateKey, createSlotKey, getDayCategory } from './slots';
import { countWeeklyShifts } from './weekly-minimums';
import type { EngineAssignment, EngineInput, EngineSlot } from './types';

const MAX_PASSES = 100;

/** Bounded local improvement. Never removes coverage, locks, or achieved weekly minimums. */
export function improveSchedule(input: EngineInput, slots: EngineSlot[], automatic: EngineAssignment[]): EngineAssignment[] {
  const employees = input.employees.filter(e => e.isActive && e.facilityId === input.period.facilityId);
  const employeeById = new Map(employees.map(e => [e.id, e]));
  const slotByKey = new Map(slots.map(s => [createSlotKey(s), s]));
  const fixed = [...(input.boundaryAssignments ?? []), ...input.manualAssignments];
  let rows = [...automatic];
  let repairBudget = 60;
  const preferenceCount = (assignments: EngineAssignment[]) => assignments.reduce((n, a) =>
    n + Number(input.preferences?.get(a.employeeId)?.has(`${createDateKey(a.date)}|${a.shiftType}`) ?? false), 0);

  // A complete exchange chain can unlock a vacancy that has no direct candidate.
  for (const slot of slots) {
    while (getSlotFillCount(slot, [...input.manualAssignments, ...rows]) < slot.requiredAmount) {
      let repaired: EngineAssignment[] | null = null;
      for (const employee of employees) {
        if (!isEligibleForSlot(employee, slot) || !isAvailable(employee.id, slot.date, slot.shiftType, input.availability)) continue;
        if (repairBudget-- <= 0) break;
        repaired = repairMinimum(input, slots, [...fixed, ...rows], employee, [slot], { displacements: 3, attempts: 100 });
        if (repaired && preferenceCount(repaired) < preferenceCount([...fixed, ...rows])) repaired = null;
        if (repaired) break;
      }
      if (!repaired) break;
      const immutable = new Set(fixed);
      rows = repaired.filter(a => !immutable.has(a));
    }
  }

  const weekend = (a: EngineAssignment) =>
    (input.holidayCategories?.get(createDateKey(a.date)) ?? getDayCategory(a.date)) !== 'WEEKDAY';
  const minimum = (shift: EngineAssignment['shiftType']) => shift === 'MORNING' ? 2 : shift === 'EVENING' ? 1 : 0;
  const weekByTime = new Map([...input.week1Dates.map(d => [d.getTime(), 1] as const),
    ...input.week2Dates.map(d => [d.getTime(), 2] as const)]);
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  };

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const current = [...input.manualAssignments, ...rows];
    const counts = countWeeklyShifts(current, input);
    const fairness = computeFairnessSummary(current, input.holidayCategories);
    const history = computeFairnessSummary(input.historicalAssignments ?? [], input.holidayCategories);
    const byEmployee = new Map(employees.map(e => [e.id, [...fixed, ...rows].filter(a => a.employeeId === e.id)]));
    const weekly = (id: string, week: 1 | 2) => (week === 1 ? counts.get(id)?.week1 : counts.get(id)?.week2) ?? { MORNING: 0, EVENING: 0, NIGHT: 0 };
    const summary = (id: string) => fairness.get(id) ?? createEmptyFairnessSummary(id);
    const weekendCount = (id: string) => summary(id).weekendShifts + (history.get(id)?.weekendShifts ?? 0);
    // Lexicographic objective: minimums, cumulative weekend equality, extras by
    // type and total extras with history, then current weekends and preferences.
    // Squared counts penalize concentration.
    const cost = (id: string, changes: Array<{ row: EngineAssignment; delta: number }>) => {
      const f = summary(id);
      let w = f.weekendShifts;
      const weeks = ([1, 2] as const).map(week => ({ ...weekly(id, week) }));
      for (const { row, delta } of changes) {
        w += Number(weekend(row)) * delta;
        const week = weekByTime.get(row.date.getTime());
        if (week) weeks[week - 1][row.shiftType] += delta;
      }
      // Preserve achieved minimums, including partial minimums in infeasible inputs.
      if (weeks.some((week, i) => (['MORNING', 'EVENING', 'NIGHT'] as const).some(shift =>
        week[shift] < Math.min(weekly(id, (i + 1) as 1 | 2)[shift], minimum(shift))))) return null;
      const extra = (shift: EngineAssignment['shiftType']) => weeks.reduce((n, week) => n + Math.max(0, week[shift] - minimum(shift)), 0);
      const m = extra('MORNING'), e = extra('EVENING'), n = extra('NIGHT');
      const h = history.get(id);
      const preferred = changes.reduce((sum, change) => sum + change.delta * Number(input.preferences?.get(id)?.has(`${createDateKey(change.row.date)}|${change.row.shiftType}`) ?? false), 0);
      const deficit = weeks.reduce((sum, week, i) => sum +
        ((i === 0 ? input.week1Dates : input.week2Dates).length ? Math.max(0, 2 - week.MORNING) + Math.max(0, 1 - week.EVENING) : 0), 0);
      return [deficit, (w + (h?.weekendShifts ?? 0)) ** 2,
        (m + (h?.morningShifts ?? 0)) ** 2 + (e + (h?.eveningShifts ?? 0)) ** 2 + (n + (h?.nightShifts ?? 0)) ** 2,
        (m + e + n + (h?.totalShifts ?? 0)) ** 2, w * w, -preferred];
    };
    const zero = employees.map(e => [e.id, cost(e.id, [])!] as const);
    const base = new Map(zero);
    const delta = (ids: string[], changes: Array<Array<{ row: EngineAssignment; delta: number }>>) => {
      const values = ids.map((id, i) => cost(id, changes[i]));
      if (values.some(value => value === null)) return null;
      const result = values[0]!.map((_, k) => values.reduce((sum, value, i) => sum + value![k] - base.get(ids[i])![k], 0));
      // Keep preferences already honored by generation while improving fairness.
      return result[5] > 0 ? null : result;
    };
    const legal = (row: EngineAssignment, id: string, removed: EngineAssignment[]) => {
      const slot = slotByKey.get(createSlotKey(row));
      return slot && canAssignEmployeeToSlot(employeeById.get(id)!, slot,
        (byEmployee.get(id) ?? []).filter(a => !removed.includes(a)), input.availability);
    };
    let best = [0, 0, 0, 0, 0, 0];
    let move: { i: number; j?: number; k?: number; receiver: string } | undefined;
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i];
      for (const employee of employees) {
        if (employee.id === a.employeeId) continue;
        const improvement = delta([a.employeeId, employee.id], [[{ row: a, delta: -1 }], [{ row: a, delta: 1 }]]);
        if (!improvement || compare(improvement, best) >= 0 || !legal(a, employee.id, [a])) continue;
        best = improvement;
        move = { i, receiver: employee.id };
      }
      for (let j = i + 1; j < rows.length; j++) {
        const b = rows[j];
        if (a.employeeId === b.employeeId) continue;
        const improvement = delta([a.employeeId, b.employeeId], [
          [{ row: a, delta: -1 }, { row: b, delta: 1 }],
          [{ row: b, delta: -1 }, { row: a, delta: 1 }],
        ]);
        if (!improvement || compare(improvement, best) >= 0 ||
            !legal(a, b.employeeId, [a, b]) || !legal(b, a.employeeId, [a, b])) continue;
        best = improvement;
        move = { i, j, receiver: b.employeeId };
      }
    }
    // Three-way exchanges escape pairwise traps, e.g. an evening minimum or
    // a specialist's role blocking an otherwise fair weekend exchange.
    if (!move) {
      let attempts = 0;
      const order = rows.map((_, i) => i).sort((i, j) => weekendCount(rows[j].employeeId) - weekendCount(rows[i].employeeId));
      const receivers = rows.map((_, i) => i).sort((i, j) => weekendCount(rows[i].employeeId) - weekendCount(rows[j].employeeId));
      search: for (const i of order) {
        const a = rows[i];
        for (const j of receivers) {
          const b = rows[j];
          if (a.employeeId === b.employeeId || !weekend(a) || weekend(b) ||
              weekendCount(a.employeeId) <= weekendCount(b.employeeId) + 1) continue;
          if (!legal(a, b.employeeId, [a, b])) continue;
          for (let k = 0; k < rows.length; k++) {
            const c = rows[k];
            if (c.employeeId === a.employeeId || c.employeeId === b.employeeId) continue;
            if (++attempts > 20000) break search;
            const improvement = delta([a.employeeId, b.employeeId, c.employeeId], [
              [{ row: a, delta: -1 }, { row: c, delta: 1 }],
              [{ row: b, delta: -1 }, { row: a, delta: 1 }],
              [{ row: c, delta: -1 }, { row: b, delta: 1 }],
            ]);
            if (!improvement || compare(improvement, best) >= 0 ||
                !legal(b, c.employeeId, [b, c]) || !legal(c, a.employeeId, [a, c])) continue;
            best = improvement;
            move = { i, j, k, receiver: b.employeeId };
            break search;
          }
        }
      }
    }
    if (!move && repairBudget > 0) {
      let exchange: EngineAssignment[] | undefined;
      const beforeWeekendCost = employees.reduce((n, e) => n + weekendCount(e.id) ** 2, 0);
      search: for (const a of rows.filter(weekend)) {
        const slot = slotByKey.get(createSlotKey(a))!;
        for (const employee of employees) {
          if (weekendCount(a.employeeId) <= weekendCount(employee.id) + 1 ||
              !isEligibleForSlot(employee, slot) || !isAvailable(employee.id, a.date, a.shiftType, input.availability)) continue;
          const improvement = delta([a.employeeId, employee.id], [[{ row: a, delta: -1 }], [{ row: a, delta: 1 }]]);
          if (!improvement || compare(improvement, [0, 0, 0, 0, 0, 0]) >= 0) continue;
          const blockers = (byEmployee.get(employee.id) ?? []).filter(b => hasShiftConflict(a.date, a.shiftType, b.date, b.shiftType));
          if (!blockers.length || blockers.some(b => fixed.includes(b))) continue;
          if (repairBudget-- <= 0) break search;
          const reserved = { ...a, employeeId: employee.id };
          let trial: EngineAssignment[] | null = [...fixed, ...rows.filter(b => b !== a && !blockers.includes(b)), reserved];
          const repairInput = { ...input, manualAssignments: [...input.manualAssignments, reserved] };
          for (const blocker of blockers) {
            const week = weekByTime.get(blocker.date.getTime());
            trial = repairMinimum(repairInput, slots, trial, employee, slots.filter(s =>
              s.shiftType === blocker.shiftType && weekByTime.get(s.date.getTime()) === week), { displacements: 6, attempts: 1000 });
            if (!trial) break;
          }
          if (!trial || preferenceCount(trial) < preferenceCount([...fixed, ...rows])) continue;
          const immutable = new Set(fixed);
          const candidate = trial.filter(b => !immutable.has(b));
          const resultFairness = computeFairnessSummary([...input.manualAssignments, ...candidate], input.holidayCategories);
          const afterWeekendCost = employees.reduce((n, e) => n +
            ((resultFairness.get(e.id)?.weekendShifts ?? 0) + (history.get(e.id)?.weekendShifts ?? 0)) ** 2, 0);
          if (afterWeekendCost < beforeWeekendCost) { exchange = candidate; break search; }
        }
      }
      if (exchange) { rows = exchange; continue; }
    }
    if (!move) break;
    const donor = rows[move.i].employeeId;
    rows[move.i] = { ...rows[move.i], employeeId: move.receiver };
    if (move.j !== undefined) {
      const third = move.k !== undefined ? rows[move.k].employeeId : donor;
      rows[move.j] = { ...rows[move.j], employeeId: third };
      if (move.k !== undefined) rows[move.k] = { ...rows[move.k], employeeId: donor };
    }
  }

  // Fairness exchanges may unlock previously blocked staffing requirements.
  let finalRepairBudget = 20;
  for (const slot of slots) {
    while (getSlotFillCount(slot, [...input.manualAssignments, ...rows]) < slot.requiredAmount) {
      let repaired: EngineAssignment[] | null = null;
      for (const employee of employees) {
        if (!isEligibleForSlot(employee, slot) || !isAvailable(employee.id, slot.date, slot.shiftType, input.availability)) continue;
        if (finalRepairBudget-- <= 0) break;
        repaired = repairMinimum(input, slots, [...fixed, ...rows], employee, [slot], { displacements: 6, attempts: 500 });
        if (repaired && preferenceCount(repaired) < preferenceCount([...fixed, ...rows])) repaired = null;
        if (repaired) break;
      }
      if (!repaired) break;
      const immutable = new Set(fixed);
      rows = repaired.filter(a => !immutable.has(a));
    }
  }

  // On the same shift, use the employee's own role whenever a legal swap allows it.
  // This preserves every employee's dates, shift counts, rest, and fairness.
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.date.getTime() !== b.date.getTime() || a.shiftType !== b.shiftType) continue;
      const x = employeeById.get(a.employeeId)!, y = employeeById.get(b.employeeId)!;
      const sa = slotByKey.get(createSlotKey(a))!, sb = slotByKey.get(createSlotKey(b))!;
      const before = Number(x.rank !== sa.requiredRank) + Number(y.rank !== sb.requiredRank);
      const after = Number(y.rank !== sa.requiredRank) + Number(x.rank !== sb.requiredRank);
      if (after < before && y.rank <= sa.requiredRank && x.rank <= sb.requiredRank) {
        rows[i] = { ...a, employeeId: y.id };
        rows[j] = { ...b, employeeId: x.id };
      }
    }
  }
  return rows;
}
