import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import type { SubmissionWindowRule } from '@/features/periods/submission-window';

function submissionWindowKey(facilityId: string) {
  return `submission-window:${facilityId}`;
}

function positionRank(position: { requiredRank: number | null; displayOrder: number; baseRole: { rank: number } | null }) {
  return position.requiredRank ?? position.baseRole?.rank ?? position.displayOrder;
}

/** Positions listed for managers. Excludes the facility officer. */
export function managerCourtPositionsWhere(facilityId: string): Prisma.PositionWhereInput {
  return {
    isActive: true,
    OR: [{ facilityId }, { facilityId: null }],
    NOT: { OR: [{ requiredRank: 1 }, { baseRole: { rank: 1 } }, { name: 'קצין מתקן' }] },
  };
}

/** Positions that appear in per-shift staffing grids. */
export function shiftStaffingPositionsWhere(facilityId: string): Prisma.PositionWhereInput {
  return managerCourtPositionsWhere(facilityId);
}

export async function getRulesCapacity(facilityId: string) {
  if (!facilityId) return [];

  return prisma.staffingRequirement.findMany({
    where: { facilityId },
    select: {
      id: true,
      shiftType: true,
      dayCategory: true,
      requiredCount: true,
    },
    orderBy: [{ shiftType: 'asc' }, { position: { displayOrder: 'asc' } }],
  });
}

async function listPositions(where: Prisma.PositionWhereInput) {
  const rows = await prisma.position.findMany({
    where,
    select: {
      id: true,
      name: true,
      color: true,
      requiredRank: true,
      displayOrder: true,
      baseRole: { select: { rank: true } },
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    rank: positionRank(row),
  }));
}

export async function getPositions(facilityId: string) {
  if (!facilityId) return [];
  return listPositions(managerCourtPositionsWhere(facilityId));
}

export async function getShiftStaffingPositions(facilityId: string) {
  if (!facilityId) return [];
  return listPositions(shiftStaffingPositionsWhere(facilityId));
}

export async function getShiftCapacities(facilityId: string) {
  if (!facilityId) return [];

  const rows = await prisma.staffingRequirement.findMany({
    where: { facilityId },
    select: {
      id: true,
      positionId: true,
      shiftType: true,
      dayCategory: true,
      requiredCount: true,
    },
    orderBy: [{ position: { displayOrder: 'asc' } }, { position: { createdAt: 'asc' } }],
  });

  return rows.map((row) => ({ ...row, positionId: row.positionId }));
}

export async function getSubmissionWindowRule(facilityId: string): Promise<SubmissionWindowRule | null> {
  if (!facilityId) return null;

  const setting = await prisma.systemSetting.findUnique({
    where: { key: submissionWindowKey(facilityId) },
  });
  const value = setting?.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const rule = value as Partial<SubmissionWindowRule>;
  if (
    typeof rule.openWeekday !== 'number' ||
    typeof rule.openTime !== 'string' ||
    typeof rule.closeWeekday !== 'number' ||
    typeof rule.closeTime !== 'string'
  ) {
    return null;
  }

  return {
    openWeekday: rule.openWeekday,
    openTime: rule.openTime,
    closeWeekday: rule.closeWeekday,
    closeTime: rule.closeTime,
  };
}

export async function saveSubmissionWindowSetting(facilityId: string, rule: SubmissionWindowRule) {
  await prisma.systemSetting.upsert({
    where: { key: submissionWindowKey(facilityId) },
    create: { key: submissionWindowKey(facilityId), value: rule },
    update: { value: rule },
  });
}
