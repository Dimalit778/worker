import { EngineEmployee, EngineSlot, FairnessSummary } from "./types";
import { isExactPositionMatch } from "./role-eligibility";

// ─── Weights ──────────────────────────────────────────────────────────────────

// Higher weight = stronger preference to avoid assigning employees who already
// have many of those shifts. All weights are positive penalties subtracted from
// a base score of 0. Higher final score = better candidate.
export const SCORING_WEIGHTS = {
  EVENING: 3,
  NIGHT: 3,
  WEEKEND: 2,
  TOTAL: 1,
  FALLBACK_POSITION: 20,
} as const;

// ─── Scoring ──────────────────────────────────────────────────────────────────

// Scores a single candidate for a given slot. Higher score = prefer this
// employee. Callers must ensure the candidate already passed all hard
// constraints — this function only measures fairness, not eligibility.
//
// slot is accepted for future context-specific scoring; not used in the
// current formula.
export function scoreCandidate(
  employee: EngineEmployee,
  slot: EngineSlot,
  fairness: FairnessSummary | undefined
): number {
  const eveningShifts = fairness?.eveningShifts ?? 0;
  const nightShifts = fairness?.nightShifts ?? 0;
  const weekendShifts = fairness?.weekendShifts ?? 0;
  const totalShifts = fairness?.totalShifts ?? 0;

  return (
    0 -
    eveningShifts * SCORING_WEIGHTS.EVENING -
    nightShifts * SCORING_WEIGHTS.NIGHT -
    weekendShifts * SCORING_WEIGHTS.WEEKEND -
    totalShifts * SCORING_WEIGHTS.TOTAL -
    (isExactPositionMatch(employee.positionName, slot.positionName)
      ? 0
      : SCORING_WEIGHTS.FALLBACK_POSITION)
  );
}

// ─── Comparison ───────────────────────────────────────────────────────────────

// Compares two pre-scored candidates. Returns negative if a should come first
// (higher score wins). Falls back to alphabetical employee id for determinism
// when scores are equal.
export function compareCandidateScores(
  a: { id: string; score: number },
  b: { id: string; score: number }
): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.id.localeCompare(b.id);
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

// Returns a new array of eligible candidates sorted best-first by score.
// Employees with no fairness record are treated as having all counters at 0
// (i.e., they score the same as a fully rested employee and are preferred via
// alphabetical tie-break).
export function sortCandidatesByScore(
  candidates: EngineEmployee[],
  slot: EngineSlot,
  fairnessByEmployee: Map<string, FairnessSummary>
): EngineEmployee[] {
  const scored = candidates.map((e) => ({
    employee: e,
    id: e.id,
    score: scoreCandidate(e, slot, fairnessByEmployee.get(e.id)),
  }));

  scored.sort(compareCandidateScores);

  return scored.map((s) => s.employee);
}
