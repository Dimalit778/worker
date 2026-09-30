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
      const membership = await tx.userFacilityRole.findUnique({
        where: { userId_facilityId: { userId: actor.userId, facilityId: actor.facilityId } },
      });
      if (membership?.role !== 'MANAGER') throw new Error('אין הרשאת ניהול למתקן');
      return fn(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034','P2002'].includes(error.code)) throw new Error(STALE_VERSION);
    throw error;
  }
}

export async function checkedVersion(tx: Prisma.TransactionClient, actor: ScheduleActor, scheduleId: string, expected: VersionExpectation) {
  if (!expected || !Number.isInteger(expected.revision) || expected.revision < 0) throw new Error(STALE_VERSION);
  const schedule = await tx.roster.findFirst({ where: { id: scheduleId, facilityId: actor.facilityId }, include: { period: true } });
  if (!schedule || schedule.archivedAt || schedule.period.endDate < todayUtcDateForTimeZone('Asia/Jerusalem')) throw new Error('לא ניתן לערוך שיבוץ זה');
  const version = await tx.rosterVersion.findFirst({ where: { scheduleId, facilityId: actor.facilityId, OR: [{ status: 'DRAFT' }, { status: 'PUBLISHED', isActive: true }] }, orderBy: { version: 'desc' } });
  if ((version?.id ?? null) !== expected.versionId || (version?.revision ?? 0) !== expected.revision) throw new Error(STALE_VERSION);
  return { schedule, version };
}

export async function editableDraft(tx: Prisma.TransactionClient, actor: ScheduleActor, scheduleId: string, expected: VersionExpectation) {
  const { schedule, version } = await checkedVersion(tx, actor, scheduleId, expected);
  if (version?.status === 'DRAFT') return { schedule, version };
  const max = await tx.rosterVersion.aggregate({ where: { scheduleId }, _max: { version: true } });
  const draft = await tx.rosterVersion.create({ data: { scheduleId, facilityId: actor.facilityId, createdById: actor.userId, version: (max._max.version ?? 0) + 1, isActive: false } });
  if (version) {
    const assignments = await tx.shiftAssignment.findMany({ where: { versionId: version.id } });
    if (assignments.length) {
      await tx.shiftAssignment.createMany({
        data: assignments.map((assignment) => ({
          scheduleId,
          facilityId: actor.facilityId,
          versionId: draft.id,
          employeeId: assignment.employeeId,
          shiftRoleId: assignment.shiftRoleId,
          date: assignment.date,
          shiftType: assignment.shiftType,
          source: assignment.source,
          isLocked: assignment.isLocked,
        })),
      });
    }
  }
  await tx.scheduleChangeLog.create({ data: {
    scheduleId, versionId: draft.id, changedById: actor.userId, changeType: 'CREATE',
    message: version ? 'נפתחה טיוטת תיקון' : 'נפתחה טיוטה ראשונה',
    afterData: { version: draft.version, copiedFromVersionId: version?.id ?? null },
  } });
  return { schedule, version: draft };
}
