import { prisma } from '@/lib/db/client';
import { ScheduleChangeType, type Prisma } from '@/generated/prisma/client';
import { readFacilityCache } from '@/lib/cache/data-cache';

export type ScheduleChangeLogEntry = {
  id: string;
  createdAt: Date;
  changeType: ScheduleChangeType;
  message: string | null;
  versionNumber: number | null;
  changedByName: string;
};

const changeSelect = {
  id: true,
  createdAt: true,
  changeType: true,
  reason: true,
  version: { select: { number: true } },
  changedBy: { select: { displayName: true } },
} satisfies Prisma.ScheduleChangeSelect;

function serializeEntry(row: Prisma.ScheduleChangeGetPayload<{ select: typeof changeSelect }>) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    changeType: row.changeType,
    message: row.reason,
    versionNumber: row.version?.number ?? null,
    changedByName: row.changedBy.displayName,
  };
}

function restoreEntry(row: ReturnType<typeof serializeEntry>): ScheduleChangeLogEntry {
  return { ...row, createdAt: new Date(row.createdAt) };
}

export async function getScheduleChangeLog(scheduleId: string, facilityId: string): Promise<ScheduleChangeLogEntry[]> {
  const entries = await readFacilityCache(facilityId, ['change-log', scheduleId], async () => {
    const rows = await prisma.scheduleChange.findMany({
      where: { scheduleId, facilityId },
      orderBy: { createdAt: 'desc' },
      select: changeSelect,
    });
    return rows.map(serializeEntry);
  });
  return entries.map(restoreEntry);
}
