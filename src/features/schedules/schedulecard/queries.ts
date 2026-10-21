import { prisma } from '@/lib/db/client';
import { readFacilityCache } from '@/lib/cache/data-cache';

export async function getFacilitySchedules(facilityId: string, visibility: 'all' | 'published' = 'all') {
  return readFacilityCache(facilityId, ['schedule-list', visibility], async () => {
    const schedules = await prisma.schedule.findMany({
      where: { facilityId, ...(visibility === 'published' ? {
        status: { in: ['PUBLISHED', 'ARCHIVED'] as ('PUBLISHED' | 'ARCHIVED')[] },
        publishedVersionId: { not: null },
      } : {}) },
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true, startDate: true, endDate: true, status: true, publishedAt: true },
    });

    return schedules.map((s) => ({
      id: s.id,
      name: s.name,
      startDate: s.startDate.toISOString().slice(0, 10),
      endDate: s.endDate.toISOString().slice(0, 10),
      status: s.status,
      publishedAt: s.publishedAt ? s.publishedAt.toISOString().slice(0, 10) : null,
    }));
  });
}
