import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { todayUtcDateForTimeZone } from '@/features/periods/utils';
import type { loadSchedulingInput } from '../generation/queries';
import { toDatedCapacityRules } from '../utils';

/** `publish`: edit a published schedule directly (new version, published in the same transaction). */
export type VersionExpectation = { versionId: string | null; revision: number; publish?: boolean };
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
          isActive: true,
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
  const schedule = await tx.schedule.findFirst({
    where: { id: scheduleId, facilityId: actor.facilityId },
    include: { draftVersion: true, publishedVersion: true },
  });
  if (!schedule || schedule.status === 'ARCHIVED' || schedule.endDate < todayUtcDateForTimeZone('Asia/Jerusalem')) throw new Error('לא ניתן לערוך שיבוץ זה');
  const version = schedule.draftVersion ?? schedule.publishedVersion;
  if ((version?.id ?? null) !== expected.versionId || (version?.revision ?? 0) !== expected.revision) throw new Error(STALE_VERSION);
  return { schedule, version };
}

export async function editableDraft(tx: Prisma.TransactionClient, actor: ScheduleActor, scheduleId: string, expected: VersionExpectation, reason?: string) {
  const { schedule, version } = await checkedVersion(tx, actor, scheduleId, expected);
  if (version?.status === 'DRAFT') return { schedule, version };
  const draft = await tx.scheduleVersion.create({ data: {
    scheduleId, facilityId: actor.facilityId, number: (version?.number ?? 0) + 1,
  } });
  if (version) {
    const slots = await tx.scheduleSlot.findMany({ where: { versionId: version.id } });
    if (slots.length) await tx.scheduleSlot.createMany({ data: slots.map(slot => ({
      scheduleId, facilityId: actor.facilityId, versionId: draft.id,
      positionId: slot.positionId, date: slot.date, shiftType: slot.shiftType,
      slotNumber: slot.slotNumber, startsAt: slot.startsAt, endsAt: slot.endsAt,
      userId: slot.userId, source: slot.source, isLocked: slot.isLocked, note: slot.note,
    })) });
  }
  await tx.schedule.update({ where: { id: scheduleId }, data: { draftVersionId: draft.id } });
  await tx.scheduleChange.create({ data: {
    facilityId: actor.facilityId, scheduleId, versionId: draft.id,
    changedById: actor.userId, changeType: 'CREATE',
    reason: reason ?? (version ? 'נפתחה טיוטת תיקון' : 'נפתחה טיוטה'),
    afterData: { copiedFromVersionId: version?.id ?? null },
  } });
  return { schedule, version: draft };
}

/** Freeze a draft version as published, snapshotting its staffing requirements. */
type LoadedInput = Awaited<ReturnType<typeof loadSchedulingInput>>;

/** Day-category rules plus this period's date overrides (entries with `date`), frozen with the version. */
export async function freezePublishedVersion(tx: Prisma.TransactionClient, versionId: string, capacities: LoadedInput['capacities'], dateOverrides: LoadedInput['dateOverrides'], publishedAt: Date) {
  await tx.scheduleVersion.update({ where: { id: versionId }, data: {
    status: 'PUBLISHED', publishedAt, revision: { increment: 1 },
    capacitySnapshot: [
      ...capacities.map(c => ({
        id: c.id, positionId: c.positionId, displayName: c.position.name, color: c.position.color,
        rank: c.position.requiredRank ?? c.position.baseRole?.rank ?? c.position.displayOrder,
        shiftType: c.shiftType, dayCategory: c.dayCategory, amount: c.requiredCount,
      })),
      ...toDatedCapacityRules(dateOverrides),
    ],
  } });
}
