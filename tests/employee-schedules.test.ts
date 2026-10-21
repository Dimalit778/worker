import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn(), people: vi.fn(), slots: vi.fn(), cache: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ prisma: { schedule: { findMany: db.findMany, findFirst: db.findFirst }, user: { findMany: db.people } } }));
vi.mock('@/lib/cache/data-cache', () => ({ readFacilityCache: db.cache }));
vi.mock('@/features/schedules/assignments/published-slots', () => ({ getPublishedSlots: db.slots }));
import { getFacilitySchedules } from '@/features/schedules/schedulecard/queries';
import { getPublishedScheduleById } from '@/features/schedules/assignments/queries';

beforeEach(() => {
  vi.resetAllMocks();
  db.cache.mockImplementation((_facility, _key, load) => load());
  db.findMany.mockResolvedValue([]);
  db.findFirst.mockResolvedValue(null);
});

describe('employee schedule visibility', () => {
  it('scopes the employee list to its facility and published/archived schedules with a published version', async () => {
    await getFacilitySchedules('employee-facility', 'published');
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      facilityId: 'employee-facility', status: { in: ['PUBLISHED', 'ARCHIVED'] }, publishedVersionId: { not: null },
    } }));
    expect(db.cache).toHaveBeenCalledWith('employee-facility', ['schedule-list', 'published'], expect.any(Function));
  });

  it('keeps manager drafts in a separate cache entry', async () => {
    await getFacilitySchedules('employee-facility');
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { facilityId: 'employee-facility' } }));
    expect(db.cache).toHaveBeenCalledWith('employee-facility', ['schedule-list', 'all'], expect.any(Function));
  });

  it('requires both the requested ID and employee facility when opening a published schedule', async () => {
    expect(await getPublishedScheduleById('requested-schedule', 'employee-facility')).toBeNull();
    expect(db.findFirst).toHaveBeenCalledWith({
      where: { id: 'requested-schedule', facilityId: 'employee-facility', status: { in: ['PUBLISHED', 'ARCHIVED'] }, publishedVersionId: { not: null } },
      include: { publishedVersion: true },
    });
    expect(db.slots).not.toHaveBeenCalled();
  });

  it('reads the published version and its frozen capacity even if a newer draft exists', async () => {
    db.findFirst.mockResolvedValue({
      id: 'schedule', facilityId: 'facility', name: 'שיבוץ שפורסם', status: 'ARCHIVED',
      startDate: new Date('2026-10-04'), endDate: new Date('2026-10-10'),
      draftVersionId: 'private-draft', publishedVersionId: 'public-version',
      publishedVersion: { id: 'public-version', revision: 3, capacitySnapshot: [] },
    });
    db.slots.mockResolvedValue([]);
    db.people.mockResolvedValue([]);
    const result = await getPublishedScheduleById('schedule', 'facility');
    expect(db.slots).toHaveBeenCalledWith('facility', 'schedule', 'public-version', 3);
    expect(result).toMatchObject({ scheduleId: 'schedule', versionId: 'public-version', scheduleStatus: 'ARCHIVED', capacity: [] });
  });
});
