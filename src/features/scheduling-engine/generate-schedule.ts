import {
  EngineAssignment,
  EngineInput,
  EngineOutput,
  EngineSlot,
  FairnessSummary,
  OverflowCandidate,
  OverflowCandidateReason,
} from "./types";
import { buildSlots, createSlotKey, getDayCategory, sortSlotsByPriority } from "./slots";
import {
  canAssignEmployeeToSlot,
  getSlotFillCount,
  isAvailable,
  isDoubleBooked,
  isEligibleForSlot,
  isSameDate,
  slotHasCapacity,
  violatesRestRule,
} from "./constraints";
import { assignWeeklyMinimums } from "./weekly-minimums";
import { sortCandidatesByScore } from "./scoring";
import { computeFairnessSummary } from "./fairness";
import { createWarnings } from "./warnings";

// ─── Private helpers ──────────────────────────────────────────────────────────

// Builds a fairness map from an initial set of assignments (typically manuals).
function initFairness(assignments: EngineAssignment[]): Map<string, FairnessSummary> {
  const map = new Map<string, FairnessSummary>();
  for (const a of assignments) {
    applyToFairness(map, a);
  }
  return map;
}

// Increments fairness counters for one assignment. Mutates the map in place;
// the map is always a locally-owned variable, never the caller's input.
function applyToFairness(
  fairness: Map<string, FairnessSummary>,
  a: EngineAssignment
): void {
  if (!fairness.has(a.employeeId)) {
    fairness.set(a.employeeId, {
      employeeId: a.employeeId,
      totalShifts: 0,
      morningShifts: 0,
      eveningShifts: 0,
      nightShifts: 0,
      weekendShifts: 0,
    });
  }

  const s = fairness.get(a.employeeId)!;
  s.totalShifts++;
  if (a.shiftType === "MORNING") s.morningShifts++;
  else if (a.shiftType === "EVENING") s.eveningShifts++;
  else if (a.shiftType === "NIGHT") s.nightShifts++;

  const cat = getDayCategory(a.date);
  if (cat === "FRIDAY" || cat === "SATURDAY" || cat === "HOLIDAY") {
    s.weekendShifts++;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateSchedule(input: EngineInput): EngineOutput {
  const startTime = Date.now();

  // ─── Phase 0 — Initialize ─────────────────────────────────────────────────

  const allSlots = sortSlotsByPriority(buildSlots(input));

  // workingAssignments grows throughout both phases. Never mutates input.
  const workingAssignments: EngineAssignment[] = [...input.manualAssignments];
  const fairness = initFairness(input.manualAssignments);

  // Slot fill counts seeded from manual assignments; passed to Phase 1 for
  // interface compatibility (weekly-minimums derives live counts internally).
  const slotFillCounts = new Map<string, number>();
  for (const slot of allSlots) {
    slotFillCounts.set(createSlotKey(slot), getSlotFillCount(slot, workingAssignments));
  }

  // ─── Phase 1 — Weekly minimums ────────────────────────────────────────────

  const { newAssignments: phase1Assignments, unmetMinimums } = assignWeeklyMinimums(
    input,
    allSlots,
    slotFillCounts,
    workingAssignments
  );

  for (const a of phase1Assignments) {
    workingAssignments.push(a);
    applyToFairness(fairness, a);
  }

  // autoAssignments collects everything the engine generates (Phase 1 + Phase 2).
  // Manual assignments are excluded from this list.
  const autoAssignments: EngineAssignment[] = [...phase1Assignments];

  // ─── Phase 2 — Fill remaining capacity ───────────────────────────────────

  const unfilledSlots: EngineSlot[] = [];
  const overflowCandidates: OverflowCandidate[] = [];

  for (const slot of allSlots) {
    // Fill one employee at a time until capacity is reached or candidates run out.
    while (slotHasCapacity(slot, workingAssignments)) {
      const eligible = input.employees.filter((e) =>
        canAssignEmployeeToSlot(e, slot, workingAssignments, input.availability)
      );

      if (eligible.length === 0) break;

      const [best] = sortCandidatesByScore(eligible, slot, fairness);

      const assignment: EngineAssignment = {
        employeeId: best.id,
        courtId: slot.courtId,
        positionId: slot.positionId,
        positionName: slot.positionName,
        date: slot.date,
        shiftType: slot.shiftType,
        slotIndex: getSlotFillCount(slot, workingAssignments),
        isManualOverride: false,
      };

      workingAssignments.push(assignment);
      autoAssignments.push(assignment);
      applyToFairness(fairness, assignment);
    }

    // ─── Overflow candidates and unfilled tracking ────────────────────────

    const fillCount = getSlotFillCount(slot, workingAssignments);

    if (fillCount === 0) {
      unfilledSlots.push(slot);
    }

    // Employees assigned to this slot (excluded from overflow).
    const assignedIds = new Set(
      workingAssignments
        .filter(
          (a) =>
            a.courtId === slot.courtId &&
            a.positionId === slot.positionId &&
            a.shiftType === slot.shiftType &&
            isSameDate(a.date, slot.date)
        )
        .map((a) => a.employeeId)
    );

    // CAPACITY_FULL when the slot is at capacity; LOWER_SCORE when the slot
    // ended short but no remaining candidates existed (rare in practice — if
    // candidates remained they would have been assigned above).
    const reason: OverflowCandidateReason =
      fillCount >= slot.requiredAmount ? "CAPACITY_FULL" : "LOWER_SCORE";

    for (const employee of input.employees) {
      if (assignedIds.has(employee.id)) continue;

      // Check all constraints except capacity: these employees were blocked
      // by lack of space, not by eligibility issues.
      if (
        isEligibleForSlot(employee, slot) &&
        isAvailable(employee.id, slot.date, slot.shiftType, input.availability) &&
        !isDoubleBooked(employee.id, slot.date, slot.shiftType, workingAssignments) &&
        !violatesRestRule(employee.id, slot.date, slot.shiftType, workingAssignments)
      ) {
        overflowCandidates.push({
          employeeId: employee.id,
          courtId: slot.courtId,
          positionId: slot.positionId,
          date: slot.date,
          shiftType: slot.shiftType,
          reason,
        });
      }
    }
  }

  // ─── Assemble output ──────────────────────────────────────────────────────

  const filledSlotCount = allSlots.filter(
    (s) => getSlotFillCount(s, workingAssignments) >= s.requiredAmount
  ).length;

  return {
    assignments: autoAssignments,
    unfilledSlots,
    unmetMinimums,
    warnings: createWarnings({
      unmetMinimums,
      slots: allSlots,
      assignments: workingAssignments,
      fairnessSummary: fairness,
    }),
    overflowCandidates,
    fairnessSummary: computeFairnessSummary(workingAssignments),
    stats: {
      totalSlots: allSlots.length,
      filledSlots: filledSlotCount,
      unfilledSlots: unfilledSlots.length,
      totalAssignments: workingAssignments.length,
      employeesWithUnmetMinimums: new Set(unmetMinimums.map((u) => u.employeeId)).size,
      durationMs: Date.now() - startTime,
    },
  };
}
