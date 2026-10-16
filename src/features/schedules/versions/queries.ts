import { prisma } from '@/lib/db/client';

export async function getLatestDraftVersionId(scheduleId: string): Promise<string | null> {
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId }, select: { draftVersionId: true } });
  return schedule?.draftVersionId ?? null;
}

export async function getPublishedActiveVersionId(scheduleId: string): Promise<string | null> {
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId }, select: { publishedVersionId: true } });
  return schedule?.publishedVersionId ?? null;
}

export async function getDraftEditingVersionId(scheduleId: string): Promise<string | null> {
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId }, select: { draftVersionId: true, publishedVersionId: true } });
  return schedule?.draftVersionId ?? schedule?.publishedVersionId ?? null;
}

export async function getDraftVersionMeta(scheduleId: string) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId }, include: { draftVersion: true, publishedVersion: true },
  });
  const version = schedule?.draftVersion ?? schedule?.publishedVersion;
  return { versionId: version?.id ?? null, revision: version?.revision ?? 0,
    hasUnpublishedDraft: !!schedule?.draftVersionId, editingVersionNumber: version?.number ?? null };
}
