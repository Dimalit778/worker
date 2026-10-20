import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), employee: vi.fn(), session: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('@/lib/db/auth-helpers', () => ({ requireEmployee: mocks.employee, requireSession: mocks.session }));
vi.mock('next/cache', async () => import('./helpers/cache-runtime'));
import { revalidateTag } from './helpers/cache-runtime';
import { scheduleTransaction } from '@/features/schedules/services/transactions';
import { saveAvailabilityDraft } from '@/features/availability/actions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.employee.mockResolvedValue({ facilityId: 'facility', employeeId: 'employee' });
});

it('expires schedule views only after the database commit resolves', async () => {
  let commit!: () => void;
  let wrote!: () => void;
  const committed = new Promise<void>(resolve => { commit = resolve; });
  const written = new Promise<void>(resolve => { wrote = resolve; });
  const tx = { $queryRaw: vi.fn(), user: { findFirst: vi.fn().mockResolvedValue({ id: 'manager' }) } };
  mocks.transaction.mockImplementation(async fn => {
    const result = await fn(tx);
    await committed;
    return result;
  });
  const result = scheduleTransaction({ facilityId: 'facility', userId: 'manager' }, async () => { wrote(); return 'saved'; });
  await written;
  expect(revalidateTag).not.toHaveBeenCalled();
  commit();
  expect(await result).toBe('saved');
  expect(revalidateTag).toHaveBeenCalledWith('facility-data-v1:facility', { expire: 0 });
});

it('does not invalidate views after a rolled-back schedule transaction', async () => {
  mocks.transaction.mockRejectedValueOnce(new Error('rollback'));
  await expect(scheduleTransaction({ facilityId: 'facility', userId: 'manager' }, async () => 'saved')).rejects.toThrow('rollback');
  expect(revalidateTag).not.toHaveBeenCalled();
});

it('availability writes invalidate manager views after commit, and not after a failed commit', async () => {
  const now = Date.now();
  const tx = {
    $queryRaw: vi.fn(),
    user: { findFirst: vi.fn().mockResolvedValue({ isActive: true }) },
    schedule: { findFirst: vi.fn().mockResolvedValue({ id: 'schedule', status: 'DRAFT', startDate: new Date('2026-10-20'), endDate: new Date('2026-10-26'), submissionOpensAt: new Date(now - 60_000), submissionClosesAt: new Date(now + 60_000) }) },
    availabilitySubmission: { upsert: vi.fn() },
  };
  mocks.transaction.mockImplementationOnce(async fn => fn(tx));
  expect((await saveAvailabilityDraft({ periodId: 'schedule', entries: {} })).ok).toBe(true);
  expect(revalidateTag).toHaveBeenCalledWith('facility-data-v1:facility', { expire: 0 });
  revalidateTag.mockClear();
  mocks.transaction.mockRejectedValueOnce(new Error('commit failed'));
  expect((await saveAvailabilityDraft({ periodId: 'schedule', entries: {} })).ok).toBe(false);
  expect(revalidateTag).not.toHaveBeenCalled();
});
