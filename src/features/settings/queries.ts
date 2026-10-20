import { cache } from 'react';
import type { Prisma, ShiftType } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import type { SubmissionWindowRule } from '@/features/periods/submission-window';
import { todayUtcDateForTimeZone } from '@/features/periods/utils';
import { expireFacilityData, readFacilityCache } from '@/lib/cache/data-cache';

const SCHEDULE_TIME_ZONE = 'Asia/Jerusalem';

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

// Both grids share a lookup. The persistent entry is expired after settings or
// admin writes; React.cache also deduplicates the lookup within one render.
export const getPositions = cache(async (facilityId: string) => {
  if (!facilityId) return [];
  return readFacilityCache(facilityId, ['positions'], () => listPositions(managerCourtPositionsWhere(facilityId)), 300);
});

export async function getShiftStaffingPositions(facilityId: string) {
  return getPositions(facilityId);
}

export async function getShiftCapacities(facilityId: string) {
  if (!facilityId) return [];

  return readFacilityCache(facilityId, ['shift-capacities'], async () => {
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
  }, 300);
}

export async function getSubmissionWindowRule(facilityId: string): Promise<SubmissionWindowRule | null> {
  if (!facilityId) return null;

  return readFacilityCache(facilityId, ['submission-window'], async () => {
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
  }, 300);
}

export type StaffingDateOverrideRow = {
  id: string;
  date: string;
  positionId: string;
  positionName: string;
  shiftType: ShiftType;
  requiredCount: number;
  label: string | null;
};

/** Upcoming (today onward) date-specific staffing overrides, ordered by date. */
export async function getStaffingDateOverrides(facilityId: string): Promise<StaffingDateOverrideRow[]> {
  if (!facilityId) return [];

  const today = todayUtcDateForTimeZone(SCHEDULE_TIME_ZONE);
  return readFacilityCache(facilityId, ['date-overrides', today.toISOString()], async () => {
    const rows = await prisma.staffingDateOverride.findMany({
      where: { facilityId, date: { gte: today } },
      select: {
        id: true,
        date: true,
        positionId: true,
        shiftType: true,
        requiredCount: true,
        label: true,
        position: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { position: { displayOrder: 'asc' } }],
    });

    return rows.map((row) => ({
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      positionId: row.positionId,
      positionName: row.position.name,
      shiftType: row.shiftType,
      requiredCount: row.requiredCount,
      label: row.label,
    }));
  }, 300);
}

export async function saveSubmissionWindowSetting(facilityId: string, rule: SubmissionWindowRule) {
  await prisma.systemSetting.upsert({
    where: { key: submissionWindowKey(facilityId) },
    create: { key: submissionWindowKey(facilityId), value: rule },
    update: { value: rule },
  });
  expireFacilityData(facilityId);
}
