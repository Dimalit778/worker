import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  schedule: { findFirst: vi.fn(), findMany: vi.fn() },
  user: { count: vi.fn(), findMany: vi.fn() }, role: { findMany: vi.fn() },
  availabilitySubmission: { findMany: vi.fn() },
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
  mocks.user.findMany.mockResolvedValue([]);
  mocks.role.findMany.mockResolvedValue([]);
  mocks.availabilitySubmission.findMany.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());
it('dashboard and current screen restrict the published period to today in Jerusalem', async () => {
  await getManagerDashboardData(2026);
  const dashboard = mocks.schedule.findFirst.mock.calls[0][0];
  await getCurrentSchedule('facility');
  const screen = mocks.schedule.findFirst.mock.calls[3][0];
  expect(screen.where).toEqual(dashboard.where);
  expect(screen.where).toEqual({ facilityId: 'facility', status: 'PUBLISHED', startDate: { lte: new Date('2026-10-25') }, endDate: { gte: new Date('2026-10-25') } });
  expect(screen.orderBy).toEqual(dashboard.orderBy);
});
it('dashboard and default draft screen exclude open submissions and expired periods', async () => {
  await getManagerDashboardData(2026);
  const dashboard = mocks.schedule.findFirst.mock.calls[1][0];
  await getDraftScheduleData('facility');
  const screen = mocks.schedule.findFirst.mock.calls[3][0];
  expect(screen.where).toEqual(dashboard.where);
  expect(screen.where).toEqual({ facilityId: 'facility', status: 'DRAFT', submissionClosesAt: { lte: new Date() }, endDate: { gte: new Date('2026-10-25') } });
  expect(screen.orderBy).toEqual(dashboard.orderBy);
});
it('dashboard falls back to the nearest draft still open for submissions', async () => {
  await getManagerDashboardData(2026);
  const open = mocks.schedule.findFirst.mock.calls[2][0];
  expect(open.where).toEqual({ facilityId: 'facility', status: 'DRAFT', submissionClosesAt: { gt: new Date() }, endDate: { gte: new Date('2026-10-25') } });
  expect(open.orderBy).toEqual({ startDate: 'asc' });
});
it('dashboard prefers a draft ready to schedule over one still open for submissions', async () => {
  const draft = (id: string) => ({ id, name: id, status: 'DRAFT', startDate: new Date('2026-11-01'), endDate: new Date('2026-11-07'), submissionOpensAt: new Date('2026-10-20'), submissionClosesAt: new Date('2026-10-30') });
  mocks.schedule.findFirst.mockImplementation(async ({ where }) => (where.submissionClosesAt?.gt ? draft('open') : null));
  expect((await getManagerDashboardData(2026)).draftSchedule?.id).toBe('open');
  mocks.schedule.findFirst.mockImplementation(async ({ where }) => (where.submissionClosesAt ? draft(where.submissionClosesAt.gt ? 'open' : 'closed') : null));
  expect((await getManagerDashboardData(2026)).draftSchedule?.id).toBe('closed');
});
it('explicit draft links select only the requested period within the manager facility', async () => {
  await getDraftScheduleData('facility', 'selected-period');
  expect(mocks.schedule.findFirst.mock.calls[0][0].where).toEqual({ facilityId: 'facility', id: 'selected-period' });
});
