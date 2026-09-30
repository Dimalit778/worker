import type { EngineEmployee, EngineSlot, FairnessSummary } from "./types";

/** Compare burden for this shift, then total work, preference, and stable identity. */
export function sortCandidatesByScore(
  candidates: EngineEmployee[],
  slot: EngineSlot,
  fairnessByEmployee: Map<string, FairnessSummary>,
  preferences?: Map<string, Set<string>>,
): EngineEmployee[] {
  const key = `${slot.date.toISOString().slice(0, 10)}|${slot.shiftType}`;
  const weekend = slot.dayCategory !== 'WEEKDAY';
  return [...candidates].sort((a, b) => {
    const x = fairnessByEmployee.get(a.id);
    const y = fairnessByEmployee.get(b.id);
    const burden = (f: FairnessSummary | undefined) =>
      (slot.shiftType === 'NIGHT' ? f?.nightShifts ?? 0 : 0) +
      (weekend ? f?.weekendShifts ?? 0 : 0);
    return burden(x) - burden(y) ||
      (x?.totalShifts ?? 0) - (y?.totalShifts ?? 0) ||
      Number(preferences?.get(b.id)?.has(key) ?? false) - Number(preferences?.get(a.id)?.has(key) ?? false) ||
      a.id.localeCompare(b.id);
  });
}
