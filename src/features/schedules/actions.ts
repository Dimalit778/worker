import { prisma } from '@/lib/db/client';
import { PrismaClient } from '@/generated/prisma/client';
import { DEFAULT_TZ } from './utils';
import { utcNoonFromCalendarISO } from './utils';
import { calendarDateISO } from './utils';
export async function getCurrentSchedulingPeriod(
  client: PrismaClient = prisma,
  options?: { timeZone?: string; now?: Date },
) {
  const timeZone = options?.timeZone ?? DEFAULT_TZ;
  const now = options?.now ?? new Date();
  const today = utcNoonFromCalendarISO(calendarDateISO(now, timeZone));

  return client.schedulingPeriod.findFirst({
    where: {
      startDate: { lte: today },
      endDate: { gte: today },
    },
    orderBy: { startDate: 'desc' },
  });
}
