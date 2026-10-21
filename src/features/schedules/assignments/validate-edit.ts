import type { Prisma } from '@/generated/prisma/client';
import type { EngineAssignment, EngineInput } from '@/features/scheduling-engine/types';
import { validateAssignments } from '@/features/scheduling-engine/validate';

/** Recognize officers already assigned by older seeds, only when validating the existing roster. */
export async function validateScheduleEdit(
  tx: Prisma.TransactionClient,
  input: EngineInput,
  assignments: EngineAssignment[],
  previousAssigneeIds: string[],
): Promise<string[]> {
  const failures = validateAssignments(input, assignments);
  if (!failures.length) return failures;

  const knownIds = new Set(input.employees.map(employee => employee.id));
  const missingIds = [...new Set(previousAssigneeIds)].filter(id => !knownIds.has(id));
  if (!missingIds.length) return failures;

  const officers = await tx.user.findMany({
    where: { id: { in: missingIds }, facilityId: input.period.facilityId, role: { rank: 1 }, isActive: true, deletedAt: null },
    select: { id: true, facilityId: true, roleId: true, isActive: true, role: { select: { rank: true } } },
  });
  if (!officers.length) return failures;

  // Keep every validation rule. These officers are never added to the picker, generation,
  // or the input used to validate newly edited placements.
  return validateAssignments({
    ...input,
    employees: [...input.employees, ...officers.map(officer => ({
      id: officer.id, facilityId: officer.facilityId!, positionId: officer.roleId,
      rank: officer.role.rank, isActive: officer.isActive,
    }))],
  }, assignments);
}
