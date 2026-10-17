import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  verificationToken: { deleteMany: vi.fn() },
  user: { update: vi.fn() },
}));
const db = vi.hoisted(() => ({ verificationToken: { findUnique: vi.fn() }, $transaction: vi.fn() }));
const hash = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db/client', () => ({ prisma: db }));
vi.mock('bcryptjs', () => ({ default: { hash } }));
import { redeemPasswordToken } from '@/lib/auth/token-store';
import { hashToken } from '@/lib/auth/tokens';

beforeEach(() => {
  vi.resetAllMocks();
  db.verificationToken.findUnique.mockResolvedValue({ identifier: 'reset:employee', expires: new Date('2099-01-01') });
  db.$transaction.mockImplementation(async fn => fn(tx));
  tx.$queryRaw.mockResolvedValue([{ id: 'employee', isActive: true }]);
  tx.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
  hash.mockResolvedValue('hashed-password');
});

describe('password token redemption', () => {
  it('consumes only a live token of the requested kind inside the password transaction', async () => {
    expect(await redeemPasswordToken('reset', 'raw-token', 'new-password')).toBe(true);
    expect(tx.verificationToken.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { identifier: 'reset:employee', token: hashToken('raw-token'), expires: { gt: expect.any(Date) } },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'employee' }, data: { passwordHash: 'hashed-password', failedLoginCount: 0, lockedUntil: null },
    });
    expect(tx.verificationToken.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { identifier: { in: ['invite:employee', 'reset:employee'] } },
    });
  });

  it('rejects an invitation presented as a reset', async () => {
    db.verificationToken.findUnique.mockResolvedValue({ identifier: 'invite:employee', expires: new Date('2099-01-01') });
    expect(await redeemPasswordToken('reset', 'raw-token', 'new-password')).toBe(false);
    expect(hash).not.toHaveBeenCalled();
  });

  it('rejects an account deactivated while hashing without consuming the token', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'employee', isActive: false }]);
    expect(await redeemPasswordToken('reset', 'raw-token', 'new-password')).toBe(false);
    expect(tx.verificationToken.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rejects a token expired or consumed while hashing without saving a password', async () => {
    tx.verificationToken.deleteMany.mockResolvedValueOnce({ count: 0 });
    expect(await redeemPasswordToken('reset', 'raw-token', 'new-password')).toBe(false);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('propagates a password write failure so the database rolls back token consumption', async () => {
    tx.user.update.mockRejectedValue(new Error('write failed'));
    await expect(redeemPasswordToken('reset', 'raw-token', 'new-password')).rejects.toThrow('write failed');
    expect(tx.verificationToken.deleteMany).toHaveBeenCalledTimes(1);
  });
});
