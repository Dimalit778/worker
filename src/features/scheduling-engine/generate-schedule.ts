import type { EngineAssignment, EngineInput, EngineOutput, EngineSlot, FairnessSummary, OverflowCandidate } from "./types";
import { buildSlots, createSlotKey, getDayCategory, sortSlotsByPriority } from "./slots";
import { canAssignEmployeeToSlot, getSlotFillCount, isAvailable, isDoubleBooked, isEligibleForSlot } from "./constraints";
import { assignWeeklyMinimums, collectUnmetMinimums, getWeekNumberForDate, MORNING_MINIMUM, EVENING_MINIMUM } from "./weekly-minimums";
import { sortCandidatesByScore } from "./scoring";
import { computeFairnessSummary, createEmptyFairnessSummary, incrementFairnessForAssignment } from "./fairness";
import { createWarnings } from "./warnings";
import { improveSchedule } from './improve-schedule';

export function generateSchedule(input: EngineInput): EngineOutput {
  const startTime = Date.now();
  const slots = sortSlotsByPriority(buildSlots(input));
  const working = [...(input.boundaryAssignments ?? []), ...input.manualAssignments];

  // Phase 1 is complete for every employee/week before any extra is considered.
  const { newAssignments: minimumAssignments } = assignWeeklyMinimums(input, slots, new Map(), working);
  const nextIndexes = new Map<string, number>();
  for (const a of input.manualAssignments) {
    const key = createSlotKey(a);
    nextIndexes.set(key, Math.max(nextIndexes.get(key) ?? 0, a.slotIndex + 1));
  }
  const nextIndex = (slot: Parameters<typeof createSlotKey>[0]) => {
    const key = createSlotKey(slot);
    const index = nextIndexes.get(key) ?? 0;
    nextIndexes.set(key, index + 1);
    return index;
  };
  const newAssignments = minimumAssignments.map(a => ({ ...a, slotIndex: nextIndex(a) }));
  let automatic = [...newAssignments];
  working.push(...newAssignments);
  let current = [...input.manualAssignments, ...newAssignments];
  const fairness = computeFairnessSummary([...(input.historicalAssignments ?? []), ...current], input.holidayCategories);
  const extras = new Map<string, FairnessSummary>();
  const weeklyCounts = new Map<string, number>();
  const category = (a: EngineAssignment) => input.holidayCategories?.get(a.date.toISOString().slice(0, 10)) ?? getDayCategory(a.date);
  const recordExtra = (a: EngineAssignment) => {
    const week = getWeekNumberForDate(a.date, input);
    if (week === null) return;
    const key = `${a.employeeId}|${week}|${a.shiftType}`;
    const count = (weeklyCounts.get(key) ?? 0) + 1;
    weeklyCounts.set(key, count);
    const minimum = a.shiftType === "MORNING" ? MORNING_MINIMUM : a.shiftType === "EVENING" ? EVENING_MINIMUM : 0;
    if (count > minimum) extras.set(a.employeeId, incrementFairnessForAssignment(
      extras.get(a.employeeId) ?? createEmptyFairnessSummary(a.employeeId), a, category(a)));
  };
  current.forEach(recordExtra);

  // Index live state so each eligibility check only scans this employee's shifts.
  const byEmployee = new Map<string, EngineAssignment[]>();
  for (const a of working) {
    if (!byEmployee.has(a.employeeId)) byEmployee.set(a.employeeId, []);
    byEmployee.get(a.employeeId)!.push(a);
  }
  const fills = new Map(slots.map(s => [createSlotKey(s), getSlotFillCount(s, working)]));
  const employees = input.employees.filter(e => e.isActive);

  // Phase 2: select scarce, under-covered requirements one person at a time.
  // Re-evaluate all remaining requirements after each placement; none are skipped forever.
  while (true) {
    const opportunities = new Map<string, number>();
    const choices: Array<{ slot: EngineSlot; candidates: typeof employees; fill: number }> = [];
    for (const slot of slots) {
      const fill = fills.get(createSlotKey(slot)) ?? 0;
      if (fill >= slot.requiredAmount) continue;
      // Global capacity was checked above; rest checks only need this employee's rows.
      const candidates = employees.filter(e => canAssignEmployeeToSlot(
        e, slot, byEmployee.get(e.id) ?? [], input.availability));
      if (!candidates.length) continue;
      choices.push({ slot, candidates, fill });
      for (const e of candidates) opportunities.set(e.id, (opportunities.get(e.id) ?? 0) + 1);
    }
    if (!choices.length) break;
    choices.sort((a, b) =>
      a.candidates.length / (a.slot.requiredAmount - a.fill) - b.candidates.length / (b.slot.requiredAmount - b.fill) ||
      a.fill / a.slot.requiredAmount - b.fill / b.slot.requiredAmount);
    const { slot, candidates, fill } = choices[0];
    const [employee] = sortCandidatesByScore(candidates, slot, fairness, input.preferences, { extras, opportunities });
    const assignment: EngineAssignment = {
      employeeId: employee.id, facilityId: slot.facilityId, positionId: slot.positionId,
      positionName: slot.positionName, date: slot.date, shiftType: slot.shiftType,
      slotIndex: nextIndex(slot), isManualOverride: false,
    };
    automatic.push(assignment);
    current.push(assignment);
    working.push(assignment);
    if (!byEmployee.has(employee.id)) byEmployee.set(employee.id, []);
    byEmployee.get(employee.id)!.push(assignment);
    fills.set(createSlotKey(slot), fill + 1);
    fairness.set(employee.id, incrementFairnessForAssignment(
      fairness.get(employee.id) ?? createEmptyFairnessSummary(employee.id), assignment, category(assignment)));
    recordExtra(assignment);
  }

  automatic = improveSchedule(input, slots, automatic);
  // Keep the output's minimum prefix useful for inspection after exchanges.
  const finalCounts = new Map<string, number>();
  for (const a of input.manualAssignments) {
    const key = `${a.employeeId}|${getWeekNumberForDate(a.date, input)}|${a.shiftType}`;
    finalCounts.set(key, (finalCounts.get(key) ?? 0) + 1);
  }
  const minimums: EngineAssignment[] = [], remaining: EngineAssignment[] = [];
  for (const a of automatic) {
    const key = `${a.employeeId}|${getWeekNumberForDate(a.date, input)}|${a.shiftType}`;
    const count = finalCounts.get(key) ?? 0;
    const minimum = a.shiftType === 'MORNING' ? MORNING_MINIMUM : a.shiftType === 'EVENING' ? EVENING_MINIMUM : 0;
    (count < minimum ? minimums : remaining).push(a);
    finalCounts.set(key, count + 1);
  }
  nextIndexes.clear();
  for (const a of input.manualAssignments) {
    const key = createSlotKey(a);
    nextIndexes.set(key, Math.max(nextIndexes.get(key) ?? 0, a.slotIndex + 1));
  }
  automatic = [...minimums, ...remaining].map(a => ({ ...a, slotIndex: nextIndex(a) }));
  current = [...input.manualAssignments, ...automatic];
  for (const slot of slots) fills.set(createSlotKey(slot), getSlotFillCount(slot, current));
  byEmployee.clear();
  for (const a of [...(input.boundaryAssignments ?? []), ...current]) {
    if (!byEmployee.has(a.employeeId)) byEmployee.set(a.employeeId, []);
    byEmployee.get(a.employeeId)!.push(a);
  }
  const unfilledSlots = slots.filter(s => (fills.get(createSlotKey(s)) ?? 0) === 0);
  const overflowCandidates: OverflowCandidate[] = [];
  // Report alternatives from the final state, not an intermediate pass.
  for (const slot of slots) {
    if ((fills.get(createSlotKey(slot)) ?? 0) < slot.requiredAmount) continue;
    for (const employee of employees) {
      if (isEligibleForSlot(employee, slot) && isAvailable(employee.id, slot.date, slot.shiftType, input.availability) &&
          !isDoubleBooked(employee.id, slot.date, slot.shiftType, byEmployee.get(employee.id) ?? [])) {
        overflowCandidates.push({ employeeId: employee.id, facilityId: slot.facilityId, positionId: slot.positionId,
          date: slot.date, shiftType: slot.shiftType, reason: "CAPACITY_FULL" });
      }
    }
  }
  const unmetMinimums = collectUnmetMinimums(input, current);
  const fairnessSummary = computeFairnessSummary(current, input.holidayCategories);
  return {
    assignments: automatic, unfilledSlots, unmetMinimums, overflowCandidates, fairnessSummary,
    warnings: createWarnings({ unmetMinimums, slots, assignments: current, fairnessSummary, timeOff: input.timeOff }),
    stats: {
      totalSlots: slots.length,
      filledSlots: slots.filter(s => (fills.get(createSlotKey(s)) ?? 0) >= s.requiredAmount).length,
      unfilledSlots: unfilledSlots.length, totalAssignments: current.length,
      employeesWithUnmetMinimums: new Set(unmetMinimums.map(u => u.employeeId)).size,
      durationMs: Date.now() - startTime,
    },
  };
}
