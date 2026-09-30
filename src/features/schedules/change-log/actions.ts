'use server';

import { requireManager } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import {
  getActiveAndUpcomingScheduleChangeLogs,
  getScheduleChangeLog,
  type ScheduleChangeLogGroup,
  type ScheduleChangeLogEntry,
} from './queries';

export async function fetchScheduleChangeLog(scheduleId: string): Promise<ScheduleChangeLogEntry[]> {
  const { facilityId } = await requireManager();

  const schedule = await prisma.roster.findFirst({
    where: { id: scheduleId, facilityId },
    select: { id: true },
  });
  if (!schedule) throw new Error('השיבוץ לא נמצא');

  return getScheduleChangeLog(scheduleId, facilityId);
}

export async function fetchActiveAndUpcomingScheduleChangeLogs(): Promise<ScheduleChangeLogGroup[]> {
  const { facilityId } = await requireManager();
  return getActiveAndUpcomingScheduleChangeLogs(facilityId);
}
