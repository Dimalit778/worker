import { prisma } from '@/lib/db/client';
import { ScheduleChangeType } from '@/generated/prisma/client';

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

export async function getScheduleChangeLog(scheduleId: string, facilityId: string): Promise<ScheduleChangeLogEntry[]> {
  const rows = await prisma.scheduleChange.findMany({
    where: { scheduleId, facilityId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      changeType: true,
      reason: true,
      version: { select: { number: true } },
      changedBy: { select: { displayName: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    changeType: row.changeType,
    message: row.reason,
    reason: row.reason,
    versionNumber: row.version?.number ?? null,
    changedByName: row.changedBy.displayName,
  }));
}

export async function getActiveAndUpcomingScheduleChangeLogs(facilityId: string): Promise<ScheduleChangeLogGroup[]> {
  const schedules = await prisma.schedule.findMany({
    where: { facilityId, changes: { some: {} } },
    select: { id: true, name: true, startDate: true },
    orderBy: { startDate: 'asc' },
  });

  const groups = await Promise.all(
    schedules.map(async (schedule) => ({
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      entries: await getScheduleChangeLog(schedule.id, facilityId),
    })),
  );

  return groups.filter((group) => group.entries.length > 0);
}
