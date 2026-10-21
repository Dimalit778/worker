import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  session: { user: { id: 'manager', facilityId: 'court-a', portal: 'MANAGER', systemRole: 'USER' } },
  users: [] as Array<{ id: string; facilityId: string; systemRole: string; canEditSchedule: boolean; isActive: boolean; deletedAt: Date | null }>,
}));
const db = vi.hoisted(() => ({
  user: { updateMany: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  role: { findMany: vi.fn() },
  scheduleSlot: { updateMany: vi.fn(), deleteMany: vi.fn() },
  availabilitySubmission: { deleteMany: vi.fn() },
}));
const requireSession = vi.hoisted(() => vi.fn());
const expireEmployeeData = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db/client', () => ({ prisma: db }));
vi.mock('@/lib/db/auth-helpers', () => ({ requireSession }));
vi.mock('@/lib/cache/data-cache', () => ({ expireEmployeeData }));
vi.mock('@/lib/auth/invite', () => ({ sendInvite: vi.fn(), unusablePasswordHash: vi.fn() }));
import { deleteEmployee, getEmployeesPageData, setEmployeeActive, resendEmployeeInvite } from '@/features/employess/actions';

beforeEach(() => {
  vi.resetAllMocks();
  state.session.user.facilityId = 'court-a';
  state.users = ['court-a', 'court-b'].map((facilityId, i) => ({
    id: `employee-${i}`, facilityId, systemRole: 'USER', canEditSchedule: false, isActive: true, deletedAt: null,
  }));
  requireSession.mockImplementation(async (role) => {
    if (role && role !== state.session.user.portal) throw new Error('UNAUTHORIZED');
    return state.session;
  });
  db.user.updateMany.mockImplementation(async ({ where, data }) => {
    const rows = state.users.filter(user => Object.entries(where).every(([key, value]) => user[key as keyof typeof user] === value));
    rows.forEach(user => Object.assign(user, data));
    return { count: rows.length };
  });
});

describe('employee deletion', () => {
  it('blocks self-deletion before any database write, including whitespace around the id', async () => {
    for (const id of ['manager', ' manager ']) {
      expect(await deleteEmployee(id)).toEqual({ error: 'לא ניתן למחוק את המשתמש שלך' });
    }
    expect(db.user.updateMany).not.toHaveBeenCalled();
    expect(expireEmployeeData).not.toHaveBeenCalled();
  });

  it('removes only the manager’s own employee while leaving all assignments and availability intact', async () => {
    expect(await deleteEmployee('employee-0')).toEqual({ ok: true });
    expect(state.users[0]).toMatchObject({ isActive: false, deletedAt: expect.any(Date) });
    expect(expireEmployeeData).toHaveBeenCalledWith('court-a');
    expect(db.scheduleSlot.updateMany).not.toHaveBeenCalled();
    expect(db.scheduleSlot.deleteMany).not.toHaveBeenCalled();
    expect(db.availabilitySubmission.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects another facility, self-deletion, other managers, and admins', async () => {
    expect(await deleteEmployee('employee-1')).toHaveProperty('error');
    expect(state.users[1].isActive).toBe(true);
    expect(await deleteEmployee('manager')).toHaveProperty('error');
    state.users[0].canEditSchedule = true;
    expect(await deleteEmployee('employee-0')).toHaveProperty('error');
    state.users[0].canEditSchedule = false;
    state.users[0].systemRole = 'ADMIN';
    expect(await deleteEmployee('employee-0')).toHaveProperty('error');
    expect(expireEmployeeData).not.toHaveBeenCalled();
  });

  it('rejects employee callers and managers without a facility', async () => {
    requireSession.mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    await expect(deleteEmployee('employee-0')).rejects.toThrow('UNAUTHORIZED');
    state.session.user.facilityId = '';
    expect(await deleteEmployee('employee-0')).toHaveProperty('error');
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it('hides deleted employees from the list and prevents reactivation and invitations', async () => {
    db.user.findMany.mockResolvedValue([]);
    db.role.findMany.mockResolvedValue([]);
    await getEmployeesPageData();
    expect(db.user.findMany.mock.calls[0][0].where).toMatchObject({ facilityId: 'court-a', deletedAt: null });
    db.user.findFirst.mockResolvedValue(null);
    expect(await setEmployeeActive('employee-0', true)).toHaveProperty('error');
    expect(await resendEmployeeInvite('employee-0')).toHaveProperty('error');
    for (const [query] of db.user.findFirst.mock.calls) expect(query.where.deletedAt).toBeNull();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('does not report success on missing, already deleted, or failed writes', async () => {
    expect(await deleteEmployee('missing')).toHaveProperty('error');
    await deleteEmployee('employee-0');
    expect(await deleteEmployee('employee-0')).toHaveProperty('error');
    db.user.updateMany.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await deleteEmployee('employee-1')).toHaveProperty('error');
  });
});
