import type { Prisma } from '@/generated/prisma/client';
import { ScheduleVersionStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';

type Tx = Prisma.TransactionClient;

/** Reuse an open draft, or create the next version (v1 first time, v2+ after publish). */
export async function resolveDraftVersionForGeneration(
  tx: Tx,
  params: { scheduleId: string; courtId: string; createdById: string },
) {
  const existingDraft = await tx.workScheduleVersion.findFirst({
    where: {
      scheduleId: params.scheduleId,
      status: ScheduleVersionStatus.DRAFT,
    },
    orderBy: { version: 'desc' },
  });

  if (existingDraft) return existingDraft;

  const maxVersion = await tx.workScheduleVersion.aggregate({
    where: { scheduleId: params.scheduleId },
    _max: { version: true },
  });

  const nextVersion = (maxVersion._max.version ?? 0) + 1;

  return tx.workScheduleVersion.create({
    data: {
      scheduleId: params.scheduleId,
      courtId: params.courtId,
      version: nextVersion,
      status: ScheduleVersionStatus.DRAFT,
      isActive: nextVersion === 1,
      createdById: params.createdById,
    },
  });
}

export async function getLatestDraftVersionId(scheduleId: string): Promise<string | null> {
  const version = await prisma.workScheduleVersion.findFirst({
    where: { scheduleId, status: ScheduleVersionStatus.DRAFT },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  return version?.id ?? null;
}

export async function getPublishedActiveVersionId(scheduleId: string): Promise<string | null> {
  const version = await prisma.workScheduleVersion.findFirst({
    where: {
      scheduleId,
      status: ScheduleVersionStatus.PUBLISHED,
      isActive: true,
    },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  return version?.id ?? null;
}

/** Manager draft UI: latest draft if editing, otherwise the live published version. */
export async function getDraftEditingVersionId(scheduleId: string): Promise<string | null> {
  const draftId = await getLatestDraftVersionId(scheduleId);
  if (draftId) return draftId;
  return getPublishedActiveVersionId(scheduleId);
}

export async function getDraftVersionMeta(scheduleId: string) {
  const draft = await prisma.workScheduleVersion.findFirst({
    where: { scheduleId, status: ScheduleVersionStatus.DRAFT },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  });

  const published = await prisma.workScheduleVersion.findFirst({
    where: { scheduleId, status: ScheduleVersionStatus.PUBLISHED, isActive: true },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  return {
    hasUnpublishedDraft: !!draft,
    editingVersionNumber: draft?.version ?? published?.version ?? null,
  };
}
