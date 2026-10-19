import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  schedule: { findFirst: vi.fn(), findMany: vi.fn() },
  user: { count: vi.fn() }, role: { findMany: vi.fn() },
}));
vi.mock('@/lib/db/client', () => ({ prisma: mocks }));
vi.mock('@/lib/db/auth-helpers', () => ({ requireSession: async () => ({ user: { facilityId: 'facility' } }) }));
import { getManagerDashboardData } from '@/features/dashboard/queries';
import { getCurrentSchedule, getDraftScheduleData } from '@/features/schedules/assignments/queries';

beforeEach(() => {
  vi.useFakeTimers();
  // Jerusalem has already crossed midnight while UTC is still on the previous day.
  vi.setSystemTime(new Date('2026-10-24T22:00Z'));
  vi.clearAllMocks();
  mocks.schedule.findFirst.mockResolvedValue(null);
  mocks.schedule.findMany.mockResolvedValue([]);
  mocks.user.count.mockResolvedValue(0);
  mocks.role.findMany.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());
it('dashboard and current screen restrict the published period to today in Jerusalem', async () => {
  await getManagerDashboardData(2026);
  const dashboard = mocks.schedule.findFirst.mock.calls[0][0];
  await getCurrentSchedule('facility');
  const screen = mocks.schedule.findFirst.mock.calls[2][0];
  expect(screen.where).toEqual(dashboard.where);
  expect(screen.where).toEqual({ facilityId: 'facility', status: 'PUBLISHED', startDate: { lte: new Date('2026-10-25') }, endDate: { gte: new Date('2026-10-25') } });
  expect(screen.orderBy).toEqual(dashboard.orderBy);
});
it('dashboard and default draft screen exclude open submissions and expired periods', async () => {
  await getManagerDashboardData(2026);
  const dashboard = mocks.schedule.findFirst.mock.calls[1][0];
  await getDraftScheduleData('facility');
  const screen = mocks.schedule.findFirst.mock.calls[2][0];
  expect(screen.where).toEqual(dashboard.where);
  expect(screen.where).toEqual({ facilityId: 'facility', status: 'DRAFT', submissionClosesAt: { lte: new Date() }, endDate: { gte: new Date('2026-10-25') } });
  expect(screen.orderBy).toEqual(dashboard.orderBy);
});
it('explicit draft links select only the requested period within the manager facility', async () => {
  await getDraftScheduleData('facility', 'selected-period');
  expect(mocks.schedule.findFirst.mock.calls[0][0].where).toEqual({ facilityId: 'facility', id: 'selected-period' });
});
