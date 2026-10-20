import { canAssignEmployeeToSlot, getSlotFillCount, hasShiftConflict, isAvailable, isEligibleForSlot } from './constraints';
import { createDateKey, createSlotKey } from './slots';
import type { EngineAssignment, EngineEmployee, EngineInput, EngineSlot } from './types';

interface Placement {
  employee: EngineEmployee;
  slots: EngineSlot[];
}

const MAX_DISPLACEMENTS = 8;
const MAX_ATTEMPTS = 2000;

/** Search complete exchange chains, preserving every displaced minimum and all locked rows. */
export function repairMinimum(
  input: EngineInput,
  slots: EngineSlot[],
  assignments: EngineAssignment[],
  employee: EngineEmployee,
  targetSlots: EngineSlot[],
  limits: { displacements?: number; attempts?: number } = {},
): EngineAssignment[] | null {
  // Exchanges preserve existing weekly counts, so an additional minimum needs
  // at least one free place somewhere in its week and shift type.
  const immutable = new Set([...(input.boundaryAssignments ?? []), ...input.manualAssignments]);
  const employees = new Map(input.employees.map(e => [e.id, e]));
  const weekByDate = new Map([
    ...input.week1Dates.map(d => [createDateKey(d), 1] as const),
    ...input.week2Dates.map(d => [createDateKey(d), 2] as const),
  ]);
  const group = (slot: EngineSlot) => `${weekByDate.get(createDateKey(slot.date))}|${slot.shiftType}`;
  const targetGroups = new Set(targetSlots.map(group));
  if (!slots.some(slot => targetGroups.has(group(slot)) && getSlotFillCount(slot, assignments) < slot.requiredAmount)) return null;
  let attempts = 0;

  function search(state: EngineAssignment[], pending: Placement[], remainingMoves: number): EngineAssignment[] | null {
    if (!pending.length) return state;
    const [{ employee: owner, slots: options }, ...rest] = pending;
    const plans: Array<{ slot: EngineSlot; blockers: EngineAssignment[] }> = [];
    for (const slot of options) {
      if (!isEligibleForSlot(owner, slot) || !isAvailable(owner.id, slot.date, slot.shiftType, input.availability)) continue;
      const conflicts = state.filter(a => a.employeeId === owner.id && hasShiftConflict(a.date, a.shiftType, slot.date, slot.shiftType));
      if (conflicts.some(a => immutable.has(a))) continue;
      const others = state.filter(a => !conflicts.includes(a));
      if (getSlotFillCount(slot, others) < slot.requiredAmount) {
        plans.push({ slot, blockers: conflicts });
      } else {
        for (const occupant of others.filter(a => !immutable.has(a) && createSlotKey(a) === createSlotKey(slot))) {
          plans.push({ slot, blockers: [...conflicts, occupant] });
        }
      }
    }
    const preferred = (slot: EngineSlot) => Number(input.preferences?.get(owner.id)?.has(`${createDateKey(slot.date)}|${slot.shiftType}`) ?? false);
    plans.sort((a, b) => a.blockers.length - b.blockers.length || preferred(b.slot) - preferred(a.slot));

    for (const { slot, blockers } of plans) {
      if (blockers.length > remainingMoves) continue;
      if (++attempts > (limits.attempts ?? MAX_ATTEMPTS)) return null;
      const withoutBlockers = state.filter(a => !blockers.includes(a));
      if (!canAssignEmployeeToSlot(owner, slot, withoutBlockers, input.availability)) continue;
      const replacements: Placement[] = [];
      for (const blocker of blockers) {
        const displaced = employees.get(blocker.employeeId);
        if (!displaced) break;
        const week = weekByDate.get(createDateKey(blocker.date));
        replacements.push({ employee: displaced, slots: slots.filter(alternative =>
          alternative.shiftType === blocker.shiftType && weekByDate.get(createDateKey(alternative.date)) === week &&
          createSlotKey(alternative) !== createSlotKey(blocker)) });
      }
      if (replacements.length !== blockers.length) continue;
      const assignment: EngineAssignment = {
        employeeId: owner.id, facilityId: slot.facilityId, positionId: slot.positionId,
        positionName: slot.positionName, date: slot.date, shiftType: slot.shiftType,
        slotIndex: getSlotFillCount(slot, withoutBlockers), isManualOverride: false,
      };
      // Keep the requested placement reserved while solving every displaced one.
      // Failure later in the chain backtracks all earlier decisions, not just the last move.
      const result = search([...withoutBlockers, assignment], [...replacements, ...rest], remainingMoves - blockers.length);
      if (result) return result;
    }
    return null;
  }
  return search(assignments, [{ employee, slots: targetSlots }], limits.displacements ?? MAX_DISPLACEMENTS);
}
