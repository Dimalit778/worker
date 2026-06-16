import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';

/** Positions listed for managers (ordering UI, capacity rules). Excludes the synthetic manager role row. */
export function managerCourtPositionsWhere(courtId: string): Prisma.PositionWhereInput {
  return {
    courtId,
    isActive: true,
    name: { not: 'מנהל' },
  };
}

/** Positions that appear in per-shift staffing grids. Excludes roles not staffed on shifts. */
export function shiftStaffingPositionsWhere(courtId: string): Prisma.PositionWhereInput {
  return {
    courtId,
    isActive: true,
    name: { notIn: ['מנהל', 'קצין מתקן'] },
  };
}

export async function getRulesCapacity(courtId: string) {
  if (!courtId) return [];

  const result = await prisma.staffingRequirement.findMany({
    where: {
      courtId,
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

export async function getPositions(courtId: string) {
  if (!courtId) return [];

  return prisma.position.findMany({
    where: managerCourtPositionsWhere(courtId),
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
    },
    orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function getShiftStaffingPositions(courtId: string) {
  if (!courtId) return [];

  return prisma.position.findMany({
    where: shiftStaffingPositionsWhere(courtId),
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
    },
    orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function getShiftCapacities(courtId: string) {
  if (!courtId) return [];

  return prisma.staffingRequirement.findMany({
    where: {
      courtId,
      isActive: true,
    },
    select: {
      id: true,
      positionId: true,
      shiftType: true,
      dayCategory: true,
      requiredCount: true,
    },
    orderBy: [{ position: { code: 'asc' } }, { position: { createdAt: 'asc' } }],
  });
}
