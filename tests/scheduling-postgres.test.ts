import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const identity = vi.hoisted(() => ({ userId: '' }));
vi.mock('next-auth', () => ({ getServerSession: async () => ({ user: { id: identity.userId }, expires: '2099-01-01' }) }));
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('UNAUTHORIZED'); } }));
vi.mock('@/lib/db/client', async () => {
  if (!process.env.TEST_DATABASE_URL) return { prisma: null };
  const target = new URL(process.env.TEST_DATABASE_URL);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Integration tests require a localhost database ending in _test');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = await import('@/generated/prisma/client');
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) }) };
});
import { prisma } from '@/lib/db/client';
import { requireManager } from '@/lib/db/auth-helpers';
import { createAssignment, removeAssignment, startScheduleCorrection } from '@/features/schedules/assignments/actions';
import { generateAutoSchedule } from '@/features/schedules/generation/actions';
import { publishSchedule } from '@/features/schedules/draft-schedule/actions';
import { getCurrentSchedule, getUpcomingSchedule } from '@/features/schedules/assignments/queries';
import { loadSchedulingInput } from '@/features/schedules/generation/queries';
import { reconcileDraftCapacity } from '@/features/schedules/services/reconcile-capacity';
import { scheduleTransaction } from '@/features/schedules/services/transactions';
import { issueToken, peekToken, redeemPasswordToken } from '@/lib/auth/token-store';
import { hashToken } from '@/lib/auth/tokens';
import bcrypt from 'bcryptjs';

const date = (day: string) => new Date(`${day}T00:00:00Z`);
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('schedule versions against migrated PostgreSQL', () => {
  let facilityId: string;
  let scheduleId: string;
  let positionId: string;
  let employeeId: string;
  let managerId: string;
  let expected: { versionId: string | null; revision: number };
  beforeEach(async () => {
    const suffix = randomUUID();
    const district = await prisma.district.create({ data: { name: 'test', code: suffix } });
    const facility = await prisma.facility.create({ data: { name: 'test', code: suffix, districtId: district.id } });
    facilityId = facility.id;
    const role = await prisma.role.upsert({ where: { rank: 4 }, update: {}, create: { code: 'GUARD', name: 'guard', rank: 4 } });
    const position = await prisma.position.create({ data: { facilityId, name: 'guard', requiredRank: 4, displayOrder: 4 } });
    positionId = position.id;
    const employee = await prisma.user.create({ data: { email: `${suffix}-emp@test.invalid`, passwordHash: 'unused', facilityId, roleId: role.id, firstName: 'Test', lastName: 'Employee', displayName: 'Test Employee' } });
    employeeId = employee.id;
    const manager = await prisma.user.create({ data: { email: `${suffix}@test.invalid`, passwordHash: 'unused', canEditSchedule: true, firstName: 'Test', lastName: 'Manager', displayName: 'Test Manager', facilityId, roleId: role.id } });
    managerId = identity.userId = manager.id;
    const schedule = await prisma.schedule.create({ data: { facilityId, name: 'test', startDate: date('2098-01-06'), endDate: date('2098-01-19'), submissionOpensAt: new Date('2020-01-01'), submissionClosesAt: date('2098-01-05') } });
    scheduleId = schedule.id;
    for (const dayCategory of ['WEEKDAY','FRIDAY','SATURDAY'] as const) {
      for (const shiftType of ['MORNING','EVENING','NIGHT'] as const) {
        await prisma.staffingRequirement.create({ data: { facilityId, positionId, dayCategory, shiftType, requiredCount: 1 } });
      }
    }
    await prisma.availabilitySubmission.create({ data: { userId: employeeId, facilityId, scheduleId, submittedAt: new Date(), availabilities: { create: [{ date: date('2098-01-06'), shiftType: 'MORNING', preference: 'PREFERRED' }, { date: date('2098-01-07'), shiftType: 'NIGHT', preference: 'AVAILABLE' }] } } });
    expected = await startScheduleCorrection(scheduleId, { versionId: null, revision: 0 });
  });
  afterAll(async () => { await prisma?.$disconnect(); });
  const add = async (token = expected) => {
    const result = await createAssignment({ scheduleId, employeeId, positionId, date: '2098-01-06', shiftType: 'MORNING', slotIndex: 0 }, token);
    expected = { versionId: result.versionId, revision: result.revision };
    return result;
  };
  const publish = async () => {
    expect(await publishSchedule(scheduleId, { ...expected, confirmIssues: true })).toEqual({ ok: true });
    const version = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: expected.versionId! } });
    expected = { versionId: version.id, revision: version.revision };
  };

  it('keeps published assignments visible until republication and counts history only once', async () => {
    await add(); await publish();
    const original = await prisma.scheduleSlot.findFirstOrThrow({ where: { versionId: expected.versionId! } });
    const oldId = expected.versionId!;
    expected = await startScheduleCorrection(scheduleId, expected);
    expect(expected.versionId).not.toBe(oldId);
    const copy = await prisma.scheduleSlot.findFirstOrThrow({ where: { versionId: expected.versionId! } });
    expect(copy).toMatchObject({ userId: original.userId, source: original.source, startsAt: original.startsAt, endsAt: original.endsAt, isLocked: original.isLocked });
    expect(copy.id).not.toBe(original.id);
    const result = await createAssignment({ scheduleId, employeeId, positionId, date: '2098-01-07', shiftType: 'NIGHT', slotIndex: 0 }, expected);
    expected.revision = result.revision;
    const visible = await getUpcomingSchedule(facilityId);
    expect(visible?.versionId).toBe(oldId);
    expect(Object.values(visible!.assignments).flat()).toHaveLength(1);
    expect(await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } })).toMatchObject({ status: 'PUBLISHED', publishedVersionId: oldId, draftVersionId: expected.versionId });
    await publish();
    expect(Object.values((await getUpcomingSchedule(facilityId))!.assignments).flat()).toHaveLength(2);
    expect(await prisma.scheduleSlot.count({ where: { scheduleId } })).toBe(3);
    const next = await prisma.schedule.create({ data: { facilityId, name: 'next', startDate: date('2098-01-20'), endDate: date('2098-02-02'), submissionOpensAt: date('2098-01-01'), submissionClosesAt: date('2098-01-19') } });
    const input = await loadSchedulingInput(prisma, next.id, facilityId, null);
    expect(input.input.historicalAssignments).toHaveLength(2);
    expect(await prisma.availabilitySubmission.count({ where: { scheduleId, userId: employeeId } })).toBe(1);
    expect(await prisma.scheduleChange.count({ where: { scheduleId, versionId: oldId, changeType: 'PUBLISH' } })).toBe(1);
  });

  it('retains the current published roster while its correction is edited', async () => {
    await add(); await publish();
    const publishedId = expected.versionId;
    // Put this fixture in the current period without changing its version or assignments.
    await prisma.schedule.update({ where: { id: scheduleId }, data: { startDate: date('2020-01-01'), endDate: date('2098-01-19') } });
    expected = await startScheduleCorrection(scheduleId, expected);
    const copy = await prisma.scheduleSlot.findFirstOrThrow({ where: { versionId: expected.versionId! } });
    const removed = await removeAssignment(copy.id, expected); expected.revision = removed.revision;
    expect((await getCurrentSchedule(facilityId))?.versionId).toBe(publishedId);
    expect(Object.values((await getCurrentSchedule(facilityId))!.assignments).flat()).toHaveLength(1);
  });

  it('does not expose an initial draft before first publication', async () => {
    await add();
    expect(await getUpcomingSchedule(facilityId)).toBeNull();
    expect(await getCurrentSchedule(facilityId)).toBeNull();
  });

  it('rejects stale edits and serializes concurrent writers', async () => {
    const token = { ...expected };
    const result = await Promise.allSettled([add(token), add(token)]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.scheduleSlot.count({ where: { scheduleId } })).toBe(1);
    await expect(add(token)).rejects.toThrow('לרענן');
  });

  it('allows exactly one concurrent correction and rejects edits using published slot IDs', async () => {
    await add(); await publish();
    const published = await prisma.scheduleSlot.findFirstOrThrow({ where: { versionId: expected.versionId! } });
    const results = await Promise.allSettled([startScheduleCorrection(scheduleId, expected), startScheduleCorrection(scheduleId, expected)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const draft = await prisma.scheduleVersion.findFirstOrThrow({ where: { scheduleId, status: 'DRAFT' } });
    expected = { versionId: draft.id, revision: draft.revision };
    await expect(removeAssignment(published.id, expected)).rejects.toThrow('בגרסה הנוכחית');
  });

  it('allows exactly one concurrent publication', async () => {
    await add();
    const options = { ...expected, confirmIssues: true };
    const results = await Promise.all([publishSchedule(scheduleId, options), publishSchedule(scheduleId, options)]);
    expect(results.filter(r => 'ok' in r)).toHaveLength(1);
    expect(await prisma.scheduleVersion.count({ where: { scheduleId, status: 'PUBLISHED' } })).toBe(1);
  });

  it('protects published slots, metadata, deletion, and moves into a published version in SQL', async () => {
    await add(); await publish();
    const publishedId = expected.versionId!;
    const assignment = await prisma.scheduleSlot.findFirstOrThrow({ where: { versionId: publishedId } });
    await expect(prisma.scheduleSlot.update({ where: { id: assignment.id }, data: { isLocked: true } })).rejects.toThrow('immutable');
    await expect(prisma.scheduleSlot.delete({ where: { id: assignment.id } })).rejects.toThrow('immutable');
    await expect(prisma.scheduleVersion.update({ where: { id: publishedId }, data: { status: 'DRAFT', publishedAt: null } })).rejects.toThrow('immutable');
    await expect(prisma.scheduleVersion.delete({ where: { id: publishedId } })).rejects.toThrow();
    expected = await startScheduleCorrection(scheduleId, expected);
    const copy = await prisma.scheduleSlot.findFirstOrThrow({ where: { versionId: expected.versionId! } });
    await expect(prisma.scheduleSlot.update({ where: { id: copy.id }, data: { versionId: publishedId } })).rejects.toThrow('immutable');
  });

  it('rejects version references belonging to another schedule or facility', async () => {
    const other = await prisma.schedule.create({ data: { facilityId, name: 'other', startDate: date('2098-02-03'), endDate: date('2098-02-16'), submissionOpensAt: date('2098-01-01'), submissionClosesAt: date('2098-02-02') } });
    await expect(prisma.schedule.update({ where: { id: other.id }, data: { draftVersionId: expected.versionId } })).rejects.toThrow();
    const assignment = { facilityId, scheduleId: other.id, versionId: expected.versionId!, userId: employeeId, positionId, date: date('2098-01-06'), shiftType: 'MORNING' as const, slotNumber: 1, startsAt: new Date('2098-01-06T05:00Z'), endsAt: new Date('2098-01-06T13:00Z') };
    await expect(prisma.scheduleSlot.create({ data: assignment })).rejects.toThrow();
  });

  it('leaves the live pointer unchanged when correction publication fails validation', async () => {
    await add(); await publish();
    const publishedId = expected.versionId!;
    expected = await startScheduleCorrection(scheduleId, expected);
    const copy = await prisma.scheduleSlot.findFirstOrThrow({ where: { versionId: expected.versionId! } });
    await prisma.scheduleSlot.update({ where: { id: copy.id }, data: { date: date('2099-01-01') } });
    const result = await publishSchedule(scheduleId, { ...expected, confirmIssues: true });
    expect('error' in result).toBe(true);
    const schedule = await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } });
    expect(schedule).toMatchObject({ status: 'PUBLISHED', publishedVersionId: publishedId, draftVersionId: expected.versionId });
    expect((await getUpcomingSchedule(facilityId))?.versionId).toBe(publishedId);
  });

  it('rejects a manager belonging to a different facility', async () => {
    const district = await prisma.district.findFirstOrThrow({ where: { facilities: { some: { id: facilityId } } } });
    const facility = await prisma.facility.create({ data: { name: 'other', code: randomUUID(), districtId: district.id } });
    const manager = await prisma.user.findUniqueOrThrow({ where: { id: managerId } });
    const other = await prisma.user.create({ data: { email: `${randomUUID()}@test.invalid`, passwordHash: 'x', facilityId: facility.id, roleId: manager.roleId, firstName: 'Other', lastName: 'Manager', displayName: 'Other Manager', canEditSchedule: true } });
    identity.userId = other.id;
    await expect(add()).rejects.toThrow();
  });

  it('uses current permissions, so a revoked manager cannot mutate', async () => {
    await prisma.user.update({ where: { id: managerId }, data: { canEditSchedule: false } });
    await expect(requireManager()).rejects.toThrow();
    await expect(add()).rejects.toThrow();
  });

  it('rechecks manager activity inside the mutation transaction', async () => {
    // Simulate a request authenticated before the manager was deactivated.
    await prisma.user.update({ where: { id: managerId }, data: { isActive: false } });
    await expect(scheduleTransaction({ facilityId, userId: managerId }, async tx => {
      await tx.schedule.update({ where: { id: scheduleId }, data: { name: 'unauthorized edit' } });
    })).rejects.toThrow('אין הרשאת ניהול');
    expect((await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } })).name).toBe('test');
  });

  it('redeems a reset once under concurrency and revokes other password links', async () => {
    const invite = await issueToken('invite', employeeId);
    const raw = await issueToken('reset', employeeId);
    const results = await Promise.all([
      redeemPasswordToken('reset', raw, 'new-password-one'),
      redeemPasswordToken('reset', raw, 'new-password-two'),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: employeeId } });
    expect(await bcrypt.compare(results[0] ? 'new-password-one' : 'new-password-two', user.passwordHash)).toBe(true);
    expect(await peekToken('invite', invite)).toBeNull();
    expect(await peekToken('reset', raw)).toBeNull();
  });

  it('rolls back token deletion when the password write fails', async () => {
    const raw = await issueToken('reset', employeeId);
    const transaction = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (callback) => {
      return transaction(async tx => callback(new Proxy(tx, {
        get(target, key) {
          if (key === 'user') return new Proxy(target.user, {
            get(model, operation) {
              if (operation === 'update') return async () => { throw new Error('simulated password write failure'); };
              return Reflect.get(model, operation);
            },
          });
          return Reflect.get(target, key);
        },
      })));
    }) as typeof prisma.$transaction);
    try {
      await expect(redeemPasswordToken('reset', raw, 'new-password')).rejects.toThrow('simulated password write failure');
    } finally {
      spy.mockRestore();
    }
    expect(await peekToken('reset', raw)).toBe(employeeId);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employeeId } })).passwordHash).toBe('unused');
    expect(await redeemPasswordToken('reset', raw, 'new-password')).toBe(true);
  });

  it('keeps exactly one valid invitation after concurrent resends', async () => {
    const links = await Promise.all([issueToken('invite', employeeId), issueToken('invite', employeeId)]);
    const valid = await Promise.all(links.map(raw => peekToken('invite', raw)));
    expect(valid.filter(Boolean)).toEqual([employeeId]);
  });

  it('rejects deactivated accounts and expired links without changing their password', async () => {
    const raw = await issueToken('reset', employeeId);
    await prisma.user.update({ where: { id: employeeId }, data: { isActive: false } });
    expect(await redeemPasswordToken('reset', raw, 'new-password')).toBe(false);
    await expect(issueToken('invite', employeeId)).rejects.toThrow('אינו פעיל');
    await prisma.user.update({ where: { id: employeeId }, data: { isActive: true } });
    await prisma.verificationToken.update({ where: { token: hashToken(raw) }, data: { expires: new Date(0) } });
    expect(await redeemPasswordToken('reset', raw, 'new-password')).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employeeId } })).passwordHash).toBe('unused');
  });

  it('regenerates only the draft and preserves the published snapshot and explicit locks', async () => {
    await add(); await publish();
    const publishedId = expected.versionId!;
    const before = await prisma.scheduleSlot.findMany({ where: { versionId: publishedId } });
    expected = await startScheduleCorrection(scheduleId, expected);
    const row = await prisma.scheduleSlot.findFirstOrThrow({ where: { versionId: expected.versionId! } });
    await prisma.scheduleSlot.update({ where: { id: row.id }, data: { isLocked: true } });
    const result = await generateAutoSchedule(scheduleId, expected);
    expect('ok' in result).toBe(true);
    expect(await prisma.scheduleSlot.findUnique({ where: { id: row.id } })).not.toBeNull();
    expect(await prisma.scheduleSlot.findMany({ where: { versionId: publishedId } })).toEqual(before);
    expect(await prisma.scheduleSlot.count({ where: { versionId: expected.versionId!, source: 'AUTOMATIC' } })).toBeGreaterThan(0);
  });

  it('keeps published capacity unchanged and reconciles only correction drafts', async () => {
    await add(); await publish();
    const publishedId = expected.versionId!;
    const visible = await getUpcomingSchedule(facilityId);
    expected = await startScheduleCorrection(scheduleId, expected);
    await scheduleTransaction({ facilityId, userId: managerId }, async tx => {
      await tx.staffingRequirement.updateMany({ where: { facilityId }, data: { requiredCount: 2 } });
      await reconcileDraftCapacity(tx, { facilityId, userId: managerId });
    });
    expect((await getUpcomingSchedule(facilityId))?.capacity).toEqual(visible?.capacity);
    expect((await getUpcomingSchedule(facilityId))?.versionId).toBe(publishedId);
  });
});
