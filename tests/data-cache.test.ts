import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/cache', async () => import('./helpers/cache-runtime'));
import { entries, revalidateTag } from './helpers/cache-runtime';
import { expireAllFacilityData, expireEmployeeData, expireFacilityData, readAdminCache, readFacilityCache } from '@/lib/cache/data-cache';

beforeEach(() => { entries.clear(); vi.clearAllMocks(); });
afterEach(() => vi.useRealTimers());

it('isolates facilities and query kinds while reusing each entry across reads', async () => {
  const load = vi.fn().mockResolvedValue({ value: 1 });
  await readFacilityCache('a', ['settings'], load);
  await readFacilityCache('a', ['settings'], load);
  expect(load).toHaveBeenCalledTimes(1);
  await readFacilityCache('b', ['settings'], load);
  await readFacilityCache('a', ['draft'], load);
  expect(load).toHaveBeenCalledTimes(3);
});

it('immediately expires all dependent views of one facility without evicting another', async () => {
  const load = vi.fn().mockResolvedValue([]);
  for (const facility of ['a', 'b']) for (const key of ['draft', 'dashboard', 'settings', 'history', 'list']) {
    await readFacilityCache(facility, [key], load);
  }
  expireFacilityData('a');
  for (const facility of ['a', 'b']) for (const key of ['draft', 'dashboard', 'settings', 'history', 'list']) {
    await readFacilityCache(facility, [key], load);
  }
  expect(load).toHaveBeenCalledTimes(15);
  expect(revalidateTag).toHaveBeenCalledWith(expect.any(String), { expire: 0 });
});

it('employee writes expire both facility views and the shared admin aggregate', async () => {
  const load = vi.fn().mockResolvedValue([]);
  await readFacilityCache('a', ['draft'], load);
  await readAdminCache(load);
  expireEmployeeData('a');
  await readFacilityCache('a', ['draft'], load);
  await readAdminCache(load);
  expect(load).toHaveBeenCalledTimes(4);
});

it('global position/admin changes expire every facility and the admin aggregate', async () => {
  const load = vi.fn().mockResolvedValue([]);
  await readFacilityCache('a', ['positions'], load);
  await readFacilityCache('b', ['positions'], load);
  await readAdminCache(load);
  expireAllFacilityData();
  expect(entries.size).toBe(0);
});

it('uses a blocking new key for time-sensitive views at the next clock window', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
  const load = vi.fn().mockResolvedValue({ status: 'OPEN' });
  await readFacilityCache('a', ['dashboard'], load, 30, true);
  vi.advanceTimersByTime(29_999);
  await readFacilityCache('a', ['dashboard'], load, 30, true);
  expect(load).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  load.mockResolvedValue({ status: 'LOCKED' });
  expect(await readFacilityCache('a', ['dashboard'], load, 30, true)).toEqual({ status: 'LOCKED' });
  expect(load).toHaveBeenCalledTimes(2);
});

it('does not retain failed reads', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
  await expect(readFacilityCache('a', ['draft'], load)).rejects.toThrow('offline');
  expect(await readFacilityCache('a', ['draft'], load)).toEqual([]);
  expect(load).toHaveBeenCalledTimes(2);
});
