import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  schedule: { findFirst: vi.fn() },
  scheduleSlot: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  cache: new Map<string, string>(),
}));
vi.mock('@/lib/db/client', () => ({ prisma: mocks }));
vi.mock('@/lib/db/auth-helpers', () => ({ requireManager: vi.fn() }));
vi.mock('next/cache', () => ({
  // Model the Data Cache boundary, including its JSON round-trip. Next owns
  // storage/expiry; these tests cover our keys, DB reads and response freshness.
  unstable_cache: (load: (...args: unknown[]) => Promise<unknown>, prefix: string[]) =>
    async (...args: unknown[]) => {
      const key = JSON.stringify([prefix, args]);
      if (!mocks.cache.has(key)) mocks.cache.set(key, JSON.stringify(await load(...args)));
      return JSON.parse(mocks.cache.get(key)!);
    },
}));

import { getCurrentSchedule, getUpcomingSchedule, getOriginalSchedule } from '@/features/schedules/assignments/queries';

const date = new Date('2026-10-20T00:00:00Z');
const startsAt = new Date('2026-10-20T04:00:00Z');
const person = { id: 'employee', displayName: 'דוד', isActive: true, role: { id: 'role', name: 'מאבטח', rank: 4 } };
const slot = {
  id: 'slot', userId: person.id, date, startsAt, shiftType: 'MORNING',
  positionId: 'position', position: { name: 'מאבטח' }, slotNumber: 1, isLocked: false,
};
const schedule = {
  id: 'schedule', facilityId: 'facility', name: 'שיבוץ', startDate: date, endDate: date,
  status: 'PUBLISHED', publishedVersionId: 'published-1',
  publishedVersion: { id: 'published-1', revision: 2, capacitySnapshot: [] },
};
const cell = '2026-10-20-MORNING-position';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cache.clear();
  mocks.schedule.findFirst.mockResolvedValue(schedule);
  mocks.scheduleSlot.findMany.mockResolvedValue([slot]);
  mocks.user.findMany.mockResolvedValue([person]);
});

describe('published schedule Data Cache', () => {
  it('shares immutable slots across current/upcoming reads while reading selection and people each time', async () => {
    const first = await getCurrentSchedule('facility');
    const second = await getUpcomingSchedule('facility');
    expect(second).toEqual(first);
    expect(mocks.scheduleSlot.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.schedule.findFirst).toHaveBeenCalledTimes(2);
    expect(mocks.user.findMany).toHaveBeenCalledTimes(2);
    expect(first?.assignments[cell][0]).toMatchObject({
      id: 'slot', employeeDisplayName: 'דוד', startsAt: startsAt.toISOString(), slotIndex: 0,
    });
    expect(mocks.scheduleSlot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { facilityId: 'facility', scheduleId: 'schedule', versionId: 'published-1', userId: { not: null }, version: { status: 'PUBLISHED' } },
    }));
  });

  it('selects a newly published version immediately without waiting for expiry', async () => {
    await getCurrentSchedule('facility');
    mocks.schedule.findFirst.mockResolvedValue({
      ...schedule, publishedVersionId: 'published-2', publishedVersion: { ...schedule.publishedVersion, id: 'published-2', revision: 3 },
    });
    mocks.scheduleSlot.findMany.mockResolvedValue([{ ...slot, id: 'replacement-slot', isLocked: true }]);
    const next = await getCurrentSchedule('facility');
    expect(mocks.scheduleSlot.findMany).toHaveBeenCalledTimes(2);
    expect(next).toMatchObject({ versionId: 'published-2', revision: 3 });
    expect(next?.assignments[cell][0]).toMatchObject({ id: 'replacement-slot', isLocked: true });
  });

  it('does not reuse an entry for a different revision, schedule or facility', async () => {
    await getCurrentSchedule('facility');
    mocks.schedule.findFirst.mockResolvedValue({ ...schedule, publishedVersion: { ...schedule.publishedVersion, revision: 3 } });
    await getCurrentSchedule('facility');
    mocks.schedule.findFirst.mockResolvedValue({ ...schedule, id: 'other-schedule' });
    await getCurrentSchedule('facility');
    mocks.schedule.findFirst.mockResolvedValue({ ...schedule, facilityId: 'other-facility' });
    await getCurrentSchedule('other-facility');
    expect(mocks.scheduleSlot.findMany).toHaveBeenCalledTimes(4);
    expect(mocks.scheduleSlot.findMany.mock.lastCall?.[0].where.facilityId).toBe('other-facility');
  });

  it('keeps renamed and inactive assignees current without evicting immutable slots', async () => {
    await getCurrentSchedule('facility');
    mocks.user.findMany.mockResolvedValue([{ ...person, displayName: 'דוד לוי', isActive: false }]);
    const next = await getCurrentSchedule('facility');
    expect(mocks.scheduleSlot.findMany).toHaveBeenCalledTimes(1);
    expect(next?.employees).toEqual([]);
    expect(next?.assignments[cell][0].employeeDisplayName).toBe('דוד לוי');
    expect(mocks.user.findMany.mock.lastCall?.[0].where).toMatchObject({
      facilityId: 'facility', OR: expect.arrayContaining([{ id: { in: ['employee'] } }]),
    });
  });

  it('preserves a deleted employee in current and original schedules while excluding them from the picker', async () => {
    mocks.user.findMany.mockResolvedValue([{ ...person, isActive: false, deletedAt: new Date() }]);
    mocks.schedule.findFirst.mockResolvedValue({ ...schedule, originalVersion: schedule.publishedVersion });
    for (const result of [await getCurrentSchedule('facility'), await getOriginalSchedule('schedule', 'facility')]) {
      expect(result?.employees).toEqual([]);
      expect(result?.assignments[cell][0]).toMatchObject({ employeeId: person.id, employeeDisplayName: person.displayName });
    }
  });

  it('offers new active employees on a cache hit and excludes assigned managers from the picker', async () => {
    await getCurrentSchedule('facility');
    mocks.user.findMany.mockResolvedValue([
      { ...person, role: { ...person.role, rank: 1 } },
      { ...person, id: 'new-employee', displayName: 'עובד חדש' },
    ]);
    const next = await getCurrentSchedule('facility');
    expect(next?.employees.map(employee => employee.id)).toEqual(['new-employee']);
    expect(next?.assignments[cell][0].employeeId).toBe(person.id);
    expect(mocks.scheduleSlot.findMany).toHaveBeenCalledTimes(1);
  });

  it('does not cache missing schedules or conceal a subsequent publication or removal', async () => {
    mocks.schedule.findFirst.mockResolvedValueOnce(null);
    expect(await getCurrentSchedule('facility')).toBeNull();
    expect(mocks.scheduleSlot.findMany).not.toHaveBeenCalled();
    expect(await getCurrentSchedule('facility')).not.toBeNull();
    mocks.schedule.findFirst.mockResolvedValueOnce(null);
    expect(await getCurrentSchedule('facility')).toBeNull();
  });

  it('retries a failed load instead of retaining the failure', async () => {
    mocks.scheduleSlot.findMany.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(getCurrentSchedule('facility')).rejects.toThrow('database unavailable');
    expect(await getCurrentSchedule('facility')).not.toBeNull();
    expect(mocks.scheduleSlot.findMany).toHaveBeenCalledTimes(2);
  });
});
