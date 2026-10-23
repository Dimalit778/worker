import { prisma } from '@/lib/db/client';
import { ScheduleChangeType, type Prisma } from '@/generated/prisma/client';
import { readFacilityCache } from '@/lib/cache/data-cache';
import { summarizeChangeLogPayloads, type AssignmentChangeKind } from './format';

export type ScheduleChangeLogEntry = {
  id: string;
  createdAt: Date;
  changeType: ScheduleChangeType;
  message: string | null;
  /** Employee name(s) for assignment edits; freeform rows leave this null. */
  summary: string | null;
  /** בוקר / ערב / לילה for assignment edits. */
  shiftLabel: string | null;
  /** Shift calendar date + weekday (DD/MM/YYYY · יום X). */
  shiftDateLabel: string | null;
  actionKind: AssignmentChangeKind | null;
  versionNumber: number | null;
  changedByName: string;
};

const changeSelect = {
  id: true,
  createdAt: true,
  changeType: true,
  reason: true,
  beforeData: true,
  afterData: true,
  version: { select: { number: true } },
  changedBy: { select: { displayName: true } },
} satisfies Prisma.ScheduleChangeSelect;

function serializeEntry(row: Prisma.ScheduleChangeGetPayload<{ select: typeof changeSelect }>) {
  const structured = summarizeChangeLogPayloads(row.beforeData, row.afterData);
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    changeType: row.changeType,
    message: row.reason,
    summary: structured?.summary ?? null,
    shiftLabel: structured?.shiftLabel ?? null,
    shiftDateLabel: structured?.shiftDateLabel ?? null,
    actionKind: structured?.kind ?? null,
    versionNumber: row.version?.number ?? null,
    changedByName: row.changedBy.displayName,
  };
}

function restoreEntry(row: ReturnType<typeof serializeEntry>): ScheduleChangeLogEntry {
  return { ...row, createdAt: new Date(row.createdAt) };
}

export async function getScheduleChangeLog(scheduleId: string, facilityId: string): Promise<ScheduleChangeLogEntry[]> {
  const entries = await readFacilityCache(facilityId, ['change-log', scheduleId, 'summary-v4'], async () => {
    const rows = await prisma.scheduleChange.findMany({
      where: { scheduleId, facilityId },
      orderBy: { createdAt: 'desc' },
      select: changeSelect,
    });
    return rows.map(serializeEntry);
  });
  return entries.map(restoreEntry);
}
