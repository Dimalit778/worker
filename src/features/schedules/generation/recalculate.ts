import type { Prisma } from '@/generated/prisma/client';
import { buildSlots } from '@/features/scheduling-engine/slots';
import type { EngineAssignment, EngineInput, UnmetMinimum } from '@/features/scheduling-engine/types';
import { computeFairnessSummary } from '@/features/scheduling-engine/fairness';
import { createWarnings } from '@/features/scheduling-engine/warnings';
import { getWeeklyMinimumStatus } from '@/features/scheduling-engine/weekly-minimums';

export function analyzeSchedule(input: EngineInput, assignments: EngineAssignment[]) {
  const unmetMinimums: UnmetMinimum[] = [];
  for (const employee of input.employees) {
    for (const weekNumber of [1, 2] as const) {
      const status = getWeeklyMinimumStatus(employee.id, weekNumber, assignments, input);
      if (!status.morningMet) unmetMinimums.push({ employeeId: employee.id, weekNumber, shiftType: 'MORNING', required: status.morningCount + status.morningNeeded, actual: status.morningCount });
      if (!status.eveningMet) unmetMinimums.push({ employeeId: employee.id, weekNumber, shiftType: 'EVENING', required: status.eveningCount + status.eveningNeeded, actual: status.eveningCount });
    }
  }
  const fairnessSummary = computeFairnessSummary(assignments);
  const warnings = createWarnings({ unmetMinimums, slots: buildSlots(input), assignments, fairnessSummary });
  return { fairnessSummary, warnings };
}

export async function saveScheduleAnalysis(tx: Prisma.TransactionClient, versionId: string, input: EngineInput, assignments: EngineAssignment[]) {
  const analysis = analyzeSchedule(input, assignments);
  await tx.scheduleWarning.deleteMany({ where: { versionId } });
  await tx.employeeScheduleStats.deleteMany({ where: { versionId } });
  if (analysis.warnings.length) await tx.scheduleWarning.createMany({ data: analysis.warnings.map(w => ({ ...w, versionId, scheduleId: input.scheduleId, facilityId: input.period.facilityId })) });
  if (analysis.fairnessSummary.size) await tx.employeeScheduleStats.createMany({ data: [...analysis.fairnessSummary.values()].map(f => ({ ...f, versionId, scheduleId: input.scheduleId, totalHours: f.totalShifts * 8 })) });
  return analysis;
}
