import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import type { SubmissionWindowRule } from '@/features/periods/submission-window';

/** Positions listed for managers (ordering UI, capacity rules). Excludes the synthetic manager role row. */
export function managerCourtPositionsWhere(facilityId: string): Prisma.ShiftRoleWhereInput {
  return {
    facilityId,
    isActive: true,
    name: { not: 'מנהל' },
  };
}

/** Positions that appear in per-shift staffing grids. Excludes roles not staffed on shifts. */
export function shiftStaffingPositionsWhere(facilityId: string): Prisma.ShiftRoleWhereInput {
  return {
    facilityId,
    isActive: true,
    name: { notIn: ['מנהל', 'קצין מתקן'] },
  };
}

export async function getRulesCapacity(facilityId: string) {
  if (!facilityId) return [];

  const result = await prisma.staffingRequirement.findMany({
    where: {
      facilityId,
      isActive: true,
    },
    select: {
      id: true,
      shiftType: true,
      dayCategory: true,
      requiredCount: true,
      isActive: true,
      displayOrder: true,
    },
    orderBy: [{ shiftType: 'asc' }, { displayOrder: 'asc' }],
  });

  return result;
}

export async function getPositions(facilityId: string) {
  if (!facilityId) return [];

  return prisma.shiftRole.findMany({
    where: managerCourtPositionsWhere(facilityId),
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      requiredCapability: true,
    },
    orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function getShiftStaffingPositions(facilityId: string) {
  if (!facilityId) return [];

  return prisma.shiftRole.findMany({
    where: shiftStaffingPositionsWhere(facilityId),
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      requiredCapability: true,
    },
    orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function getShiftCapacities(facilityId: string) {
  if (!facilityId) return [];

  return prisma.staffingRequirement.findMany({
    where: {
      facilityId,
      isActive: true,
    },
    select: {
      id: true,
      shiftRoleId: true,
      shiftType: true,
      dayCategory: true,
      requiredCount: true,
    },
    orderBy: [{ shiftRole: { code: 'asc' } }, { shiftRole: { createdAt: 'asc' } }],
  }).then((rows) => rows.map((row) => ({ ...row, positionId: row.shiftRoleId })));
}

export async function getSubmissionWindowRule(facilityId: string): Promise<SubmissionWindowRule | null> {
  if (!facilityId) return null;

  const court = await prisma.facility.findUnique({
    where: { id: facilityId },
    select: {
      submissionOpenWeekday: true,
      submissionOpenTime: true,
      submissionCloseWeekday: true,
      submissionCloseTime: true,
    },
  });

  if (
    !court ||
    court.submissionOpenWeekday == null ||
    !court.submissionOpenTime ||
    court.submissionCloseWeekday == null ||
    !court.submissionCloseTime
  ) {
    return null;
  }

  return {
    openWeekday: court.submissionOpenWeekday,
    openTime: court.submissionOpenTime,
    closeWeekday: court.submissionCloseWeekday,
    closeTime: court.submissionCloseTime,
  };
}
