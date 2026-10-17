import { prisma } from '@/lib/db/client';

export async function getFacilitySchedules(facilityId: string) {
  const schedules = await prisma.schedule.findMany({
    where: { facilityId },
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
}
