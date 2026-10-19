import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  schedule: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  scheduleVersion: { create: vi.fn() }, user: { count: vi.fn() },
}));
vi.mock('@/lib/db/client', () => ({ prisma: mocks }));
vi.mock('@/lib/db/auth-helpers', () => ({ requireSession: async () => ({ user: { id: 'manager', facilityId: 'facility' } }) }));
vi.mock('@/features/schedules/services/transactions', () => ({ scheduleTransaction: async (_actor: unknown, fn: (tx: unknown) => unknown) => fn(mocks) }));
vi.mock('@/features/periods/process-windows', () => ({ processDueSubmissionWindows: async () => ({ emailErrors: {} }) }));
import { createSchedule, getSchedulesList } from '@/features/periods/actions';

const data = { name: 'שיבוץ', startDate: '2026-10-25', endDate: '2026-11-07', submissionOpensAt: '2026-10-20T10:00', submissionDeadline: '2026-10-23T17:00' };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-19T10:00Z'));
  vi.clearAllMocks();
  mocks.schedule.findFirst.mockResolvedValue(null);
  mocks.schedule.create.mockResolvedValue({ id: 'schedule', facilityId: 'facility' });
  mocks.scheduleVersion.create.mockResolvedValue({ id: 'version' });
  mocks.schedule.update.mockResolvedValue({ id: 'schedule' });
});
afterEach(() => vi.useRealTimers());

describe('period length validation', () => {
  it.each(['2026-10-31', '2026-11-07'])('accepts inclusive 7/14-day periods ending %s', async endDate => {
    expect(await createSchedule({ ...data, endDate })).toMatchObject({ ok: true });
    expect(mocks.schedule.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ endDate: new Date(`${endDate}T00:00Z`) }) }));
  });
  it.each(['2026-10-25', '2026-10-30', '2026-11-01', '2026-11-08', '2026-10-24'])('rejects unsupported ranges ending %s', async endDate => {
    expect(await createSchedule({ ...data, endDate })).toHaveProperty('error');
    expect(mocks.schedule.create).not.toHaveBeenCalled();
  });
  it.each(['2026-02-30', '2026-13-01', 'invalid'])('returns validation errors for %s', async startDate => {
    expect(await createSchedule({ ...data, startDate })).toHaveProperty('error');
    expect(mocks.schedule.create).not.toHaveBeenCalled();
  });
  it('rejects overlap, then accepts the next selected period', async () => {
    mocks.schedule.findFirst.mockResolvedValueOnce({ name: 'existing', startDate: new Date('2026-10-18'), endDate: new Date('2026-10-31') });
    expect(await createSchedule(data)).toMatchObject({ error: expect.stringContaining('חופפת') });
    expect(await createSchedule({ ...data, startDate: '2026-11-01', endDate: '2026-11-14' })).toMatchObject({ ok: true });
  });
});
it('counts only active non-manager employees and their final submissions', async () => {
  mocks.schedule.findMany.mockResolvedValue([]);
  mocks.user.count.mockResolvedValue(0);
  expect(await getSchedulesList()).toEqual([]);
  expect(mocks.user.count).toHaveBeenCalledWith({ where: { facilityId: 'facility', isActive: true, role: { rank: { not: 1 } } } });
  expect(mocks.schedule.findMany.mock.calls[0][0].include._count.select.submissions.where).toEqual({ submittedAt: { not: null }, user: { isActive: true, role: { rank: { not: 1 } } } });
});
