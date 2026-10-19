import { canAssignEmployeeToSlot, getSlotFillCount, hasShiftConflict, isAvailable, isEligibleForSlot } from './constraints';
import { createSlotKey } from './slots';
import type { EngineAssignment, EngineEmployee, EngineInput, EngineSlot } from './types';

/** Bounded exchanges of generated minimums; locked and boundary rows are immutable. */
export function repairMinimum(
  input: EngineInput,
  slots: EngineSlot[],
  assignments: EngineAssignment[],
  employee: EngineEmployee,
  targetSlots: EngineSlot[],
): EngineAssignment[] | null {
  // Exchanges preserve every existing weekly shift count. With no free place
  // anywhere in this week's target shift, increasing its count is impossible.
  if (!targetSlots.some(slot => getSlotFillCount(slot, assignments) < slot.requiredAmount)) return null;
  const immutable = new Set([...(input.boundaryAssignments ?? []), ...input.manualAssignments]);
  const employees = new Map(input.employees.map(e => [e.id, e]));
  const weekByDate = new Map([
    ...input.week1Dates.map(d => [d.toISOString().slice(0, 10), 1] as const),
    ...input.week2Dates.map(d => [d.toISOString().slice(0, 10), 2] as const),
  ]);
  let attempts = 0;
  function place(e: EngineEmployee, slot: EngineSlot, state: EngineAssignment[], depth: number, path: Set<string>): EngineAssignment[] | null {
    if (++attempts > 200 || !isEligibleForSlot(e, slot) || !isAvailable(e.id, slot.date, slot.shiftType, input.availability)) return null;
    const key = `${e.id}|${createSlotKey(slot)}`;
    if (path.has(key)) return null;
    if (canAssignEmployeeToSlot(e, slot, state, input.availability)) {
      return [...state, { employeeId: e.id, facilityId: slot.facilityId, positionId: slot.positionId,
        positionName: slot.positionName, date: slot.date, shiftType: slot.shiftType,
        slotIndex: getSlotFillCount(slot, state), isManualOverride: false }];
    }
    if (!depth) return null;
    const conflicts = state.filter(a => a.employeeId === e.id && hasShiftConflict(a.date, a.shiftType, slot.date, slot.shiftType));
    if (conflicts.some(a => immutable.has(a))) return null;
    // Move one blocker at a time, then retry the original placement with every rule checked again.
    const blockers = conflicts.length ? [conflicts[0]] : state.filter(a => createSlotKey(a) === createSlotKey(slot));
    const nextPath = new Set(path).add(key);
    for (const blocker of blockers) {
      if (immutable.has(blocker)) continue;
      const owner = employees.get(blocker.employeeId);
      if (!owner) continue;
      const week = weekByDate.get(blocker.date.toISOString().slice(0, 10));
      for (const alternative of slots) {
        if (alternative.shiftType !== blocker.shiftType || createSlotKey(alternative) === createSlotKey(blocker) ||
            weekByDate.get(alternative.date.toISOString().slice(0, 10)) !== week) continue;
        const moved = place(owner, alternative, state.filter(a => a !== blocker), depth - 1, nextPath);
        if (!moved) continue;
        const result = place(e, slot, moved, depth - 1, path);
        if (result) return result;
      }
    }
    return null;
  }
  for (const slot of targetSlots) {
    const result = place(employee, slot, assignments, 4, new Set());
    if (result) return result;
  }
  return null;
}
