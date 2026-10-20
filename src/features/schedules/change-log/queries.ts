import { prisma } from '@/lib/db/client';
import { ScheduleChangeType, type Prisma } from '@/generated/prisma/client';
import { readFacilityCache } from '@/lib/cache/data-cache';

export type ScheduleChangeLogEntry = {
  id: string;
  createdAt: Date;
  changeType: ScheduleChangeType;
  message: string | null;
  reason: string | null;
  versionNumber: number | null;
  changedByName: string;
};

export type ScheduleChangeLogGroup = {
  scheduleId: string;
  scheduleName: string;
  entries: ScheduleChangeLogEntry[];
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
    reason: row.reason,
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

export async function getActiveAndUpcomingScheduleChangeLogs(facilityId: string): Promise<ScheduleChangeLogGroup[]> {
  const groups = await readFacilityCache(facilityId, ['change-log-groups'], async () => {
    // Load the related entries together instead of one query per schedule.
    const schedules = await prisma.schedule.findMany({
      where: { facilityId, changes: { some: { facilityId } } },
      select: {
        id: true, name: true,
        changes: { where: { facilityId }, select: changeSelect, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { startDate: 'asc' },
    });
    return schedules.map(schedule => ({
      scheduleId: schedule.id, scheduleName: schedule.name, entries: schedule.changes.map(serializeEntry),
    }));
  });
  return groups.map(group => ({ ...group, entries: group.entries.map(restoreEntry) }));
}
