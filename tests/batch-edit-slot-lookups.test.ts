import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), manager: vi.fn(), load: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('@/lib/db/auth-helpers', () => ({ requireManager: mocks.manager, requireSession: vi.fn() }));
vi.mock('@/features/schedules/generation/queries', () => ({ loadSchedulingInput: mocks.load }));
vi.mock('@/features/schedules/assignments/loaded-details', () => ({ loadedScheduleDetails: () => ({ assignments: {}, warnings: [], fairness: [] }) }));
vi.mock('@/features/scheduling-engine/validate', () => ({ validateAssignments: vi.fn(() => []) }));
vi.mock('@/features/scheduling-engine/manual-violations', () => ({ computeManualViolations: () => ({ blocking: [], violations: [] }) }));
import { saveScheduleChanges, type SlotChange } from '@/features/schedules/assignments/actions';
import { shiftBounds } from '@/features/schedules/shift-times';
import { validateAssignments } from '@/features/scheduling-engine/validate';
import type { EngineAssignment, EngineInput } from '@/features/scheduling-engine/types';

type Slot = {
  id: string; scheduleId: string; versionId: string; facilityId: string; positionId: string; date: Date;
  shiftType: string; slotNumber: number; startsAt: Date; endsAt: Date; userId: string | null; source: string; isLocked: boolean;
};

const day = '2026-10-26';
const date = new Date(`${day}T00:00:00Z`);
const morning = shiftBounds(date, '07:00', '15:00');
const long = { startTime: '07:00', endTime: '19:00' };
const longBounds = shiftBounds(date, long.startTime, long.endTime);
let nextId = 1;
let slots: Slot[];
let tx: ReturnType<typeof makeTx>;

function slot(slotNumber: number, userId: string | null, extra: Partial<Slot> = {}): Slot {
  return { id: `s${nextId++}`, scheduleId: 'sch', versionId: 'v1', facilityId: 'fac', positionId: 'p1', date, shiftType: 'MORNING', slotNumber, ...morning, userId, source: 'AUTO', isLocked: false, ...extra };
}

const matches = (s: Slot, where: Partial<Slot>) => Object.entries(where).every(([k, v]) => v instanceof Date ? (s as Record<string, unknown>)[k] instanceof Date && +(s as Record<string, Date>)[k] === +v : (s as Record<string, unknown>)[k] === v);

function makeTx(ownedPositions: string[]) {
  return {
    $queryRaw: vi.fn(),
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'manager' }), findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id: string) => ({ id, displayName: id }))) },
    schedule: { findFirst: vi.fn().mockResolvedValue({ id: 'sch', status: 'DRAFT', endDate: new Date('2099-01-01'), draftVersionId: 'v1', draftVersion: { id: 'v1', status: 'DRAFT', revision: 0 }, publishedVersion: null }) },
    scheduleVersion: { update: vi.fn() },
    scheduleChange: { create: vi.fn(), createMany: vi.fn() },
    position: { findMany: vi.fn(async () => ownedPositions.map(id => ({ id, name: id }))), findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ownedPositions.includes(where.id) ? { id: where.id } : null) },
    scheduleSlot: {
      findMany: vi.fn(async ({ where }: { where: Partial<Slot> }) => slots.filter(s => matches(s, where)).map(s => ({ ...s }))),
      findFirst: vi.fn(async ({ where }: { where: Partial<Slot> }) => { const found = slots.find(s => matches(s, where)); return found ? { ...found } : null; }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => { slots = slots.filter(s => s.id !== where.id); }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Slot> }) => {
        const found = slots.find(s => s.id === where.id)!;
        Object.assign(found, data);
        return { ...found };
      }),
      create: vi.fn(async ({ data }: { data: Omit<Slot, 'id'> }) => {
        if (slots.some(s => s.versionId === data.versionId && +s.date === +data.date && s.shiftType === data.shiftType && s.positionId === data.positionId && s.slotNumber === data.slotNumber)) throw new Error('unique constraint');
        const created = { id: `s${nextId++}`, ...data } as Slot;
        slots.push(created);
        return { ...created };
      }),
    },
  };
}

const change = (slotIndex: number, employeeId: string | null, extra: Partial<SlotChange> = {}): SlotChange => ({ date: day, shiftType: 'MORNING', positionId: 'p1', slotIndex, employeeId, ...extra });
const save = (changes: SlotChange[]) => saveScheduleChanges('sch', { versionId: 'v1', revision: 0 }, changes);
const stored = (slotNumber: number) => slots.filter(s => s.slotNumber === slotNumber && s.positionId === 'p1');

beforeEach(() => {
  vi.clearAllMocks();
  nextId = 1;
  slots = [];
  tx = makeTx(['p1', 'p2']);
  mocks.manager.mockResolvedValue({ facilityId: 'fac', userId: 'manager' });
  mocks.transaction.mockImplementation(async fn => fn(tx));
  mocks.load.mockImplementation(async () => ({ input: {}, allAssignments: [], assignments: slots.filter(s => s.userId).map(s => ({ ...s })), toEngine: (a: unknown) => a }));
});

describe('batch save slot lookups', () => {
  it('saves a new employee in a published roster containing an officer from an older seed', async () => {
    const real = await vi.importActual<typeof import('@/features/scheduling-engine/validate')>('@/features/scheduling-engine/validate');
    vi.mocked(validateAssignments).mockImplementationOnce(real.validateAssignments).mockImplementationOnce(real.validateAssignments);
    slots = [slot(1, 'officer'), slot(2, null)];
    tx.schedule.findFirst.mockResolvedValue({
      id: 'sch', status: 'PUBLISHED', endDate: new Date('2099-01-01'), draftVersionId: null,
      originalVersionId: 'original', publishedVersionId: 'v1',
      publishedVersion: { id: 'v1', status: 'PUBLISHED', revision: 0 },
    } as never);
    tx.user.findMany.mockResolvedValue([{
      id: 'officer', displayName: 'Officer', facilityId: 'fac', roleId: 'officer-role', isActive: true, role: { rank: 1 },
    }] as never);
    const input: EngineInput = {
      period: { id: 'sch', facilityId: 'fac', startDate: date, endDate: date },
      week1Dates: [date], week2Dates: [],
      employees: [{ id: 'staff', facilityId: 'fac', positionId: 'guard-role', rank: 4, isActive: true }],
      capacities: [{ positionId: 'p1', requiredRank: 4, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 2 }],
      availability: new Map([['officer', new Set([`${day}|MORNING`])]]), manualAssignments: [],
    };
    const toEngine = (s: Slot): EngineAssignment => ({
      employeeId: s.userId!, facilityId: s.facilityId, positionId: s.positionId, date: s.date,
      shiftType: s.shiftType as EngineAssignment['shiftType'], slotIndex: s.slotNumber - 1,
      isManualOverride: s.isLocked, source: 'AUTOMATIC',
      ...(s.source === 'MANUAL' ? { source: 'MANUAL' } : {}),
    });
    mocks.load.mockImplementation(async () => ({
      input, allAssignments: slots.filter(s => s.userId).map(toEngine),
      assignments: slots.filter(s => s.userId), toEngine,
    }));

    const result = await saveScheduleChanges('sch', { versionId: 'v1', revision: 0, publish: true }, [change(1, 'staff')]);
    expect(result).toMatchObject({ ok: true, revision: 1, published: true });
    expect(stored(1)).toMatchObject([{ userId: 'officer', source: 'AUTO' }]);
    expect(stored(2)).toMatchObject([{ userId: 'staff', source: 'MANUAL' }]);
    expect(input.employees.map(employee => employee.id)).toEqual(['staff']);
  });

  it('applies a multi-change batch without a per-change slot or position query', async () => {
    slots = [slot(1, 'a'), slot(2, 'b'), slot(3, 'c', { positionId: 'p2' })];
    const result = await save([
      change(0, 'x'), // update existing
      change(1, null), // clear existing
      change(2, 'y'), // create in p1
      change(3, 'z'), // create in p1 (same position)
      change(4, 'w', { positionId: 'p2' }), // create in p2
      change(5, null), // clear a slot that does not exist
    ]);
    expect(result.ok).toBe(true);
    expect(tx.scheduleSlot.findMany).toHaveBeenCalledTimes(1);
    expect(tx.scheduleSlot.findFirst).not.toHaveBeenCalled();
    expect(tx.position.findFirst).toHaveBeenCalledTimes(2);
    expect(tx.scheduleSlot.update).toHaveBeenCalledTimes(1);
    expect(tx.scheduleSlot.delete).toHaveBeenCalledTimes(1);
    expect(tx.scheduleSlot.create).toHaveBeenCalledTimes(3);
    expect(stored(1)).toMatchObject([{ userId: 'x', source: 'MANUAL' }]);
    expect(stored(2)).toEqual([]);
    expect(stored(3)).toMatchObject([{ userId: 'y', source: 'MANUAL' }]);
    expect(stored(4)).toMatchObject([{ userId: 'z', source: 'MANUAL' }]);
    expect(slots.find(s => s.positionId === 'p2' && s.slotNumber === 5)).toMatchObject({ userId: 'w' });
    expect(slots.find(s => s.positionId === 'p2' && s.slotNumber === 3)).toMatchObject({ userId: 'c' });
  });

  it('logs the slots as they were before the batch', async () => {
    slots = [slot(1, 'a')];
    await save([change(0, 'x'), change(1, 'y')]);
    const logged = tx.scheduleChange.createMany.mock.calls[0][0].data;
    expect(logged).toHaveLength(2);
    expect(logged[0].beforeData).toMatchObject({ slotNumber: 1, assignment: { userId: 'a' } });
    expect(logged[0].afterData).toMatchObject({ slotNumber: 1, assignment: { userId: 'x' } });
    expect(logged[1].beforeData).toMatchObject({ assignment: null });
    expect(logged[1].afterData).toMatchObject({ assignment: { userId: 'y' } });
  });

  it('applies the same cell twice in order, each change seeing the previous result', async () => {
    slots = [slot(1, 'a', { ...longBounds, isLocked: true })];
    await save([change(0, 'x'), change(0, 'y')]);
    expect(tx.scheduleSlot.update).toHaveBeenCalledTimes(2);
    // A new employee starts from the default hours; the lock is only changed by an explicit hours value.
    expect(stored(1)).toMatchObject([{ userId: 'y', isLocked: true, ...morning }]);
  });

  it('keeps hours set by an earlier change when a later change keeps the same employee', async () => {
    slots = [slot(1, 'a')];
    await save([change(0, 'x', { hours: long }), change(0, 'x')]);
    // The second change finds employee x already in the slot (as a fresh query would), so the custom hours stay.
    expect(stored(1)).toMatchObject([{ userId: 'x', isLocked: true, ...longBounds }]);
  });

  it('clears a cell then fills it again: the cleared row is gone and a new one is created', async () => {
    slots = [slot(1, 'a')];
    const oldId = slots[0].id;
    await save([change(0, null), change(0, 'x')]);
    expect(tx.scheduleSlot.delete).toHaveBeenCalledTimes(1);
    expect(tx.scheduleSlot.create).toHaveBeenCalledTimes(1);
    expect(tx.position.findFirst).toHaveBeenCalledTimes(1);
    expect(stored(1)).toHaveLength(1);
    expect(stored(1)[0]).toMatchObject({ userId: 'x', source: 'MANUAL' });
    expect(stored(1)[0].id).not.toBe(oldId);
  });

  it('fills a cell then clears it: nothing remains and nothing is queried', async () => {
    await save([change(0, 'x'), change(0, null)]);
    expect(tx.scheduleSlot.create).toHaveBeenCalledTimes(1);
    expect(tx.scheduleSlot.delete).toHaveBeenCalledTimes(1);
    expect(tx.scheduleSlot.findFirst).not.toHaveBeenCalled();
    expect(slots).toEqual([]);
  });

  it('updates the slot a previous change created instead of creating it again', async () => {
    await save([change(0, 'x'), change(0, 'y')]);
    expect(tx.scheduleSlot.create).toHaveBeenCalledTimes(1);
    expect(tx.scheduleSlot.update).toHaveBeenCalledTimes(1);
    expect(tx.position.findFirst).toHaveBeenCalledTimes(1);
    expect(stored(1)).toMatchObject([{ userId: 'y', source: 'MANUAL', isLocked: false, ...morning }]);
  });

  it('keeps custom hours of a slot created earlier in the batch for the same employee', async () => {
    await save([change(0, 'x', { hours: long }), change(0, 'x')]);
    expect(tx.scheduleSlot.create).toHaveBeenCalledTimes(1);
    expect(stored(1)).toMatchObject([{ userId: 'x', isLocked: true, ...longBounds }]);
  });

  it('does not mix up cells that differ in position, shift or date', async () => {
    slots = [slot(1, 'a'), slot(1, 'b', { shiftType: 'EVENING' }), slot(1, 'c', { positionId: 'p2' }), slot(1, 'd', { date: new Date('2026-10-27T00:00:00Z') })];
    await save([change(0, 'x')]);
    expect(slots.map(s => s.userId)).toEqual(['x', 'b', 'c', 'd']);
  });

  it('rejects a position outside the facility with the same error, checking it once', async () => {
    tx = makeTx(['p1']);
    await expect(save([change(0, 'x', { positionId: 'foreign' }), change(1, 'y', { positionId: 'foreign' })])).rejects.toThrow('התפקיד אינו שייך למתקן');
    expect(tx.position.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.scheduleSlot.create).not.toHaveBeenCalled();
    expect(tx.scheduleChange.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid position only when a change has to create a slot', async () => {
    tx = makeTx([]);
    slots = [slot(1, 'a', { positionId: 'foreign' })];
    await save([change(0, 'x', { positionId: 'foreign' })]);
    expect(tx.position.findFirst).not.toHaveBeenCalled();
    expect(slots[0].userId).toBe('x');
  });
});
