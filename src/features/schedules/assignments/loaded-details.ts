import type { loadSchedulingInput } from '../generation/queries';
import { analyzeSchedule } from '../generation/recalculate';
import { computeFairnessSummary } from '@/features/scheduling-engine/fairness';
import { toWarningSummaries } from '../warnings/summaries';
import { buildAssignmentMap } from './utils';

/** Reuse the engine's loaded rows for display instead of querying them again. */
export function loadedScheduleDetails(data: Awaited<ReturnType<typeof loadSchedulingInput>>) {
  const employees = data.employees.map(e => ({
    id: e.id, displayName: e.displayName,
    position: { id: e.role.id, name: e.role.name, rank: e.role.rank },
  })).sort((a, b) => a.position.rank - b.position.rank);
  const capacity = [...data.capacities].sort((a, b) => a.shiftType.localeCompare(b.shiftType) || a.position.displayOrder - b.position.displayOrder || a.positionId.localeCompare(b.positionId) || a.dayCategory.localeCompare(b.dayCategory) || a.id.localeCompare(b.id)).map(c => ({
    id: c.id, positionId: c.positionId, displayName: c.position.name,
    rank: c.position.requiredRank ?? c.position.baseRole?.rank ?? c.position.displayOrder,
    color: c.position.color, shiftType: c.shiftType, dayCategory: c.dayCategory, amount: c.requiredCount,
  }));
  const names = new Map(employees.map(e => [e.id, e.displayName]));
  const positions = new Map(capacity.map(c => [c.positionId, c.displayName]));
  const assignments = buildAssignmentMap([...data.assignments]
    .sort((a, b) => a.slotNumber - b.slotNumber)
    .flatMap(a => a.userId ? [{
      id: a.id, date: a.date, shiftType: a.shiftType, positionId: a.positionId,
      positionName: a.position?.name ?? positions.get(a.positionId) ?? '', employeeId: a.userId,
      employeeDisplayName: a.user?.displayName ?? names.get(a.userId) ?? '', slotIndex: a.slotNumber - 1, isLocked: a.isLocked,
    }] : []));
  const analysis = analyzeSchedule(data.input, data.allAssignments);
  const combined = computeFairnessSummary([...(data.input.historicalAssignments ?? []), ...data.allAssignments]);
  const fairness = employees.map(e => ({
    employeeId: e.id, employeeName: e.displayName,
    totalShifts: combined.get(e.id)?.totalShifts ?? 0,
    nightShifts: combined.get(e.id)?.nightShifts ?? 0,
    weekendShifts: combined.get(e.id)?.weekendShifts ?? 0,
    draftShifts: analysis.fairnessSummary.get(e.id)?.totalShifts ?? 0,
  }));
  return { employees, capacity, assignments, fairness,
    warnings: toWarningSummaries(data.schedule.id, analysis.warnings, employees, capacity) };
}
