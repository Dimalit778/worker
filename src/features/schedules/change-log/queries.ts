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
  const rows = await prisma.scheduleChangeLog.findMany({
    where: { scheduleId, schedule: { facilityId } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      changeType: true,
      message: true,
      reason: true,
      version: { select: { version: true } },
      changedBy: {
        select: {
          email: true,
          employee: { select: { displayName: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    changeType: row.changeType,
    message: row.message,
    reason: row.reason,
    versionNumber: row.version?.version ?? null,
    changedByName: row.changedBy.employee?.displayName ?? row.changedBy.email,
  }));
}

/** All retained schedule history for the court, including completed/archived periods. */
export async function getActiveAndUpcomingScheduleChangeLogs(facilityId: string): Promise<ScheduleChangeLogGroup[]> {

  const schedules = await prisma.roster.findMany({
    where: {
      facilityId,
      changeLogs: { some: {} },
    },
    select: { id: true, period: { select: { name: true, startDate: true } } },
    orderBy: { period: { startDate: 'asc' } },
  });

  const groups = await Promise.all(
    schedules.map(async (schedule) => ({
      scheduleId: schedule.id,
      scheduleName: schedule.period.name,
      entries: await getScheduleChangeLog(schedule.id, facilityId),
    })),
  );

  return groups.filter((group) => group.entries.length > 0);
}
