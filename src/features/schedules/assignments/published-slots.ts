import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';

// Cache Components is not enabled in this app. Use Next's Data Cache for the
// roster rows by version AND revision; current selection and people stay live.
// Every direct edit/approved transfer increments the revision, changing the cache key.
export const getPublishedSlots = unstable_cache(
  async (facilityId: string, scheduleId: string, versionId: string, revision: number) => {
    // Revision is part of the cache key, not a row predicate: a concurrent save
    // between selecting the revision and loading slots must not produce an empty roster.
    void revision;
    const rows = await prisma.scheduleSlot.findMany({
      where: {
        facilityId,
        scheduleId,
        versionId,
        userId: { not: null },
        version: { status: 'PUBLISHED' },
      },
      select: {
        id: true,
        userId: true,
        date: true,
        startsAt: true,
        endsAt: true,
        shiftType: true,
        positionId: true,
        position: { select: { name: true } },
        slotNumber: true,
        isLocked: true,
      },
      orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { slotNumber: 'asc' }],
    });

    // Data Cache uses JSON: keep both cache misses and hits in the same shape.
    return rows.map(row => ({
      ...row,
      date: row.date.toISOString(),
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString(),
    }));
  },
  ['published-schedule-slots-v2'],
  { revalidate: 3600 },
);
