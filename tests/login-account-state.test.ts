import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));
const compare = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db/client', () => ({ prisma: db }));
vi.mock('bcryptjs', () => ({ default: { compare } }));
import { authOptions } from '@/lib/auth/auth';

const user = {
  id: 'employee', email: 'employee@test.invalid', passwordHash: 'original-hash', isActive: true,
  displayName: 'Employee', systemRole: 'USER', facilityId: 'facility', canEditSchedule: false,
};
// NextAuth stores CredentialsProvider's supplied handlers under options.
const provider = authOptions.providers[0] as unknown as {
  options: { authorize: (credentials: { identifier: string; password: string }, request: object) => Promise<unknown> };
};
const login = () => provider.options.authorize({ identifier: user.email, password: 'password' }, {});

beforeEach(() => {
  vi.resetAllMocks();
  db.user.findFirst.mockResolvedValue({ ...user });
  db.user.updateMany.mockResolvedValue({ count: 1 });
  compare.mockResolvedValue(true);
});

describe('login account state races', () => {
  it('rejects an already inactive employee before comparing passwords', async () => {
    db.user.findFirst.mockResolvedValue({ ...user, isActive: false });
    expect(await login()).toBeNull();
    expect(compare).not.toHaveBeenCalled();
  });

  it.each(['deactivation', 'password reset'])('rejects %s during password comparison', async () => {
    db.user.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await login()).toBeNull();
    expect(db.user.updateMany).toHaveBeenLastCalledWith({
      where: { id: user.id, isActive: true, passwordHash: user.passwordHash },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  });

  it('authenticates when the account and password remain current', async () => {
    expect(await login()).toMatchObject({ id: user.id, facilityId: user.facilityId });
  });
});
