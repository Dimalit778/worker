import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  employeeRequest: { findMany: vi.fn() },
  scheduleSlot: { findMany: vi.fn() },
}));
vi.mock('@/lib/db/client', () => ({ prisma: mocks }));

import { getManagerQueue } from '@/features/requests/queries';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const request = (id: string, requesterId: string, o: Record<string, unknown> = {}) => ({
  id, type: 'TIME_OFF', status: 'PENDING_MANAGER', requesterId, targetUserId: null,
  startDate: d('2026-10-19'), endDate: d('2026-10-21'), slotId: null,
  reason: null, decisionNote: null, overrideReason: null, decidedAt: null, createdAt: d('2026-10-17'),
  requester: { displayName: requesterId }, target: null, decidedBy: null, slot: null, ...o,
});
const slot = (id: string, userId: string, date: string, shiftType = 'MORNING', versionId = 'published') => ({
  id, userId, date: d(date), shiftType, versionId,
  position: { name: 'מאבטח' }, schedule: { name: 'תקופה', draftVersionId: 'draft' },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.scheduleSlot.findMany.mockResolvedValue([
    slot('a-20', 'a', '2026-10-20'),
    slot('a-21-draft', 'a', '2026-10-21', 'MORNING', 'draft'),
    slot('a-22', 'a', '2026-10-22', 'EVENING'),
    slot('a-25', 'a', '2026-10-25'),
    slot('b-20', 'b', '2026-10-20'),
    slot('b-25', 'b', '2026-10-25'),
  ]);
});

describe('getManagerQueue affected slots', () => {
  it('loads slots for all open range requests in one query and assigns each its own user and dates', async () => {
    mocks.employeeRequest.findMany.mockResolvedValue([
      request('r1', 'a'),
      request('r2', 'b', { type: 'URGENT_ABSENCE', startDate: d('2026-10-25'), endDate: d('2026-10-26') }),
      request('r3', 'a', { startDate: d('2026-10-22'), endDate: d('2026-10-23') }),
      request('closed', 'a', { status: 'APPROVED' }),
      request('swap', 'a', { type: 'SHIFT_SWAP', status: 'PENDING_PEER' }),
    ]);

    const queue = await getManagerQueue('facility', 'all');

    expect(mocks.scheduleSlot.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleSlot.findMany.mock.calls[0][0].where).toMatchObject({
      facilityId: 'facility', userId: { in: ['a', 'b'] }, date: { gte: d('2026-10-19'), lte: d('2026-10-26') },
    });
    const affected = Object.fromEntries(queue.map(r => [r.id, r.affectedSlots.map(s => s.id)]));
    expect(affected).toEqual({ r1: ['a-20', 'a-21-draft'], r2: ['b-25'], r3: ['a-22'], closed: [], swap: [] });
    expect(queue.find(r => r.id === 'r1')!.affectedSlots[1]).toEqual({
      id: 'a-21-draft', date: '2026-10-21', shiftType: 'MORNING', positionName: 'מאבטח', scheduleName: 'תקופה', versionKind: 'DRAFT',
    });
  });

  it('does not query slots when no request is open with a date range', async () => {
    mocks.employeeRequest.findMany.mockResolvedValue([
      request('closed', 'a', { status: 'REJECTED' }),
      request('swap', 'a', { type: 'SHIFT_SWAP', status: 'PENDING_MANAGER', startDate: null, endDate: null }),
    ]);

    const queue = await getManagerQueue('facility', 'all');

    expect(mocks.scheduleSlot.findMany).not.toHaveBeenCalled();
    expect(queue.map(r => r.affectedSlots)).toEqual([[], []]);
  });
});
