import { ScheduleStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';

export async function getLatestDraftVersionId(scheduleId: string): Promise<string | null> {
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, status: ScheduleStatus.DRAFT },
    select: { id: true },
  });
  return schedule?.id ?? null;
}

export async function getPublishedActiveVersionId(scheduleId: string): Promise<string | null> {
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, status: ScheduleStatus.PUBLISHED },
    select: { id: true },
  });
  return schedule?.id ?? null;
}

/** Manager draft UI edits the schedule row itself. A published schedule is the live version. */
export async function getDraftEditingVersionId(scheduleId: string): Promise<string | null> {
  const draftId = await getLatestDraftVersionId(scheduleId);
  if (draftId) return draftId;
  return getPublishedActiveVersionId(scheduleId);
}

export async function getDraftVersionMeta(scheduleId: string) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, status: true, revision: true },
  });

  return {
    versionId: schedule?.id ?? null,
    revision: schedule?.revision ?? 0,
    hasUnpublishedDraft: schedule?.status === ScheduleStatus.DRAFT,
    editingVersionNumber: schedule ? schedule.revision : null,
  };
}
