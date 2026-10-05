import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { todayUtcDateForTimeZone } from '@/features/periods/utils';

export type VersionExpectation = { versionId: string | null; revision: number };
export type ScheduleActor = { facilityId: string; userId: string };
export const STALE_VERSION = 'השיבוץ השתנה. יש לרענן ולנסות שוב';

/** Serialize schedule changes per facility, including adjacent-period rest checks. */
export async function scheduleTransaction<T>(actor: ScheduleActor, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Facility" WHERE id=${actor.facilityId} FOR UPDATE`;
      const editor = await tx.user.findFirst({
        where: {
          id: actor.userId,
          OR: [{ systemRole: 'ADMIN' }, { facilityId: actor.facilityId, canEditSchedule: true }],
        },
        select: { id: true },
      });
      if (!editor) throw new Error('אין הרשאת ניהול למתקן');
      return fn(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034','P2002'].includes(error.code)) throw new Error(STALE_VERSION);
    throw error;
  }
}

export async function checkedVersion(tx: Prisma.TransactionClient, actor: ScheduleActor, scheduleId: string, expected: VersionExpectation) {
  if (!expected || !Number.isInteger(expected.revision) || expected.revision < 0) throw new Error(STALE_VERSION);
  const schedule = await tx.schedule.findFirst({ where: { id: scheduleId, facilityId: actor.facilityId } });
  if (!schedule || schedule.status === 'ARCHIVED' || schedule.endDate < todayUtcDateForTimeZone('Asia/Jerusalem')) throw new Error('לא ניתן לערוך שיבוץ זה');
  if (schedule.id !== expected.versionId || schedule.revision !== expected.revision) throw new Error(STALE_VERSION);
  return { schedule, version: schedule };
}

export async function editableDraft(tx: Prisma.TransactionClient, actor: ScheduleActor, scheduleId: string, expected: VersionExpectation) {
  const { schedule, version } = await checkedVersion(tx, actor, scheduleId, expected);
  if (version.status === 'DRAFT') return { schedule, version };
  const draft = await tx.schedule.update({
    where: { id: schedule.id },
    data: { status: 'DRAFT', revision: { increment: 1 } },
  });
  await tx.scheduleChange.create({ data: {
    facilityId: actor.facilityId,
    scheduleId,
    changedById: actor.userId,
    changeType: 'CREATE',
    reason: 'נפתחה טיוטת תיקון',
    afterData: { copiedFromStatus: version.status },
  } });
  return { schedule: draft, version: draft };
}
