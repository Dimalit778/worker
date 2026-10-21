import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ prisma: { $transaction: mocks.transaction } }));
import { Prisma } from '@/generated/prisma/client';
import { STALE_VERSION, scheduleTransaction } from '@/features/schedules/services/transactions';

const actor = { facilityId: 'facility', userId: 'manager' };
// The shape @prisma/adapter-pg and @prisma/adapter-neon throw for SQLSTATE 40001.
const driverConflict = () => Object.assign(new Error('TransactionWriteConflict'), {
  name: 'DriverAdapterError',
  cause: { originalCode: '40001', originalMessage: 'could not serialize access due to read/write dependencies among transactions', kind: 'TransactionWriteConflict' },
});
const prismaConflict = () => new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', { code: 'P2034', clientVersion: 'test' });

beforeEach(() => { vi.resetAllMocks(); });

it('retries a serialization conflict and returns the next attempt', async () => {
  mocks.transaction.mockRejectedValueOnce(driverConflict()).mockResolvedValueOnce('saved');
  expect(await scheduleTransaction(actor, async () => 'unused')).toBe('saved');
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
});

it('shows the refresh message when every attempt conflicts', async () => {
  mocks.transaction.mockRejectedValueOnce(prismaConflict()).mockRejectedValueOnce(driverConflict()).mockRejectedValueOnce(driverConflict());
  await expect(scheduleTransaction(actor, async () => 'unused')).rejects.toThrow(STALE_VERSION);
  expect(mocks.transaction).toHaveBeenCalledTimes(3);
});

it('does not retry other failures', async () => {
  mocks.transaction.mockRejectedValueOnce(new Error('אין הרשאת ניהול למתקן'));
  await expect(scheduleTransaction(actor, async () => 'unused')).rejects.toThrow('אין הרשאת ניהול למתקן');
  mocks.transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }));
  await expect(scheduleTransaction(actor, async () => 'unused')).rejects.toThrow(STALE_VERSION);
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
});
