import { ScheduleVersionStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';

export async function getLatestDraftVersionId(scheduleId: string): Promise<string | null> {
  const version = await prisma.rosterVersion.findFirst({
    where: { scheduleId, status: ScheduleVersionStatus.DRAFT },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  return version?.id ?? null;
}

export async function getPublishedActiveVersionId(scheduleId: string): Promise<string | null> {
  const version = await prisma.rosterVersion.findFirst({
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
  const draft = await prisma.rosterVersion.findFirst({
    where: { scheduleId, status: ScheduleVersionStatus.DRAFT },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, revision: true },
  });

  const published = await prisma.rosterVersion.findFirst({
    where: { scheduleId, status: ScheduleVersionStatus.PUBLISHED, isActive: true },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, revision: true },
  });

  return {
    versionId: draft?.id ?? published?.id ?? null,
    revision: draft?.revision ?? published?.revision ?? 0,
    hasUnpublishedDraft: !!draft,
    editingVersionNumber: draft?.version ?? published?.version ?? null,
  };
}
