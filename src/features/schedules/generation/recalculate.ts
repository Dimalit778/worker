import type { Prisma } from '@/generated/prisma/client';
import { buildSlots } from '@/features/scheduling-engine/slots';
import type { EngineAssignment, EngineInput } from '@/features/scheduling-engine/types';
import { computeFairnessSummary } from '@/features/scheduling-engine/fairness';
import { createWarnings } from '@/features/scheduling-engine/warnings';
import { collectUnmetMinimums } from '@/features/scheduling-engine/weekly-minimums';

export function analyzeSchedule(input: EngineInput, assignments: EngineAssignment[]) {
  const unmetMinimums = collectUnmetMinimums(input, assignments);
  const fairnessSummary = computeFairnessSummary(assignments, input.holidayCategories);
  const warnings = createWarnings({ unmetMinimums, slots: buildSlots(input), assignments, fairnessSummary, timeOff: input.timeOff });
  return { fairnessSummary, warnings };
}

export async function saveScheduleAnalysis(_tx: Prisma.TransactionClient, _versionId: string, input: EngineInput, assignments: EngineAssignment[]) {
  return analyzeSchedule(input, assignments);
}
