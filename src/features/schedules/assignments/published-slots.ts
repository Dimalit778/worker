import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';

// Cache Components is not enabled in this app. Use Next's Data Cache for the
// immutable slots only; session, current-version selection and people stay live.
// Every publication/direct edit/approved transfer creates a new version key.
export const getPublishedSlots = unstable_cache(
  async (facilityId: string, scheduleId: string, versionId: string, revision: number) => {
    const rows = await prisma.scheduleSlot.findMany({
      where: {
        facilityId,
        scheduleId,
        versionId,
        userId: { not: null },
        version: { status: 'PUBLISHED', revision },
      },
      select: {
        id: true,
        userId: true,
        date: true,
        startsAt: true,
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
    }));
  },
  ['published-schedule-slots-v1'],
  { revalidate: 3600 },
);
