import type { EngineEmployee, EngineSlot, FairnessSummary } from "./types";

/** Compare burden for this shift, then total work, preference, and stable identity. */
export function sortCandidatesByScore(
  candidates: EngineEmployee[],
  slot: EngineSlot,
  fairnessByEmployee: Map<string, FairnessSummary>,
  preferences?: Map<string, Set<string>>,
  additional?: { extras: Map<string, FairnessSummary>; opportunities: Map<string, number> },
): EngineEmployee[] {
  const key = `${slot.date.toISOString().slice(0, 10)}|${slot.shiftType}`;
  const weekend = slot.dayCategory !== 'WEEKDAY';
  return [...candidates].sort((a, b) => {
    const x = fairnessByEmployee.get(a.id);
    const y = fairnessByEmployee.get(b.id);
    const burden = (f: FairnessSummary | undefined) =>
      (slot.shiftType === 'NIGHT' ? f?.nightShifts ?? 0 : 0) +
      (weekend ? f?.weekendShifts ?? 0 : 0);
    const shiftCount = (f: FairnessSummary | undefined) => slot.shiftType === 'MORNING' ? f?.morningShifts ?? 0 :
      slot.shiftType === 'EVENING' ? f?.eveningShifts ?? 0 : f?.nightShifts ?? 0;
    const extraA = additional?.extras.get(a.id);
    const extraB = additional?.extras.get(b.id);
    return (weekend ? (x?.weekendShifts ?? 0) - (y?.weekendShifts ?? 0) : 0) ||
      (additional ? shiftCount(extraA) - shiftCount(extraB) : 0) ||
      (additional ? (extraA?.totalShifts ?? 0) - (extraB?.totalShifts ?? 0) : 0) ||
      burden(x) - burden(y) ||
      (x?.totalShifts ?? 0) - (y?.totalShifts ?? 0) ||
      (additional ? (additional.opportunities.get(a.id) ?? 0) - (additional.opportunities.get(b.id) ?? 0) : 0) ||
      Number(preferences?.get(b.id)?.has(key) ?? false) - Number(preferences?.get(a.id)?.has(key) ?? false) ||
      a.id.localeCompare(b.id);
  });
}
