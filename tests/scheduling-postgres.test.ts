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
import { createAssignment, startScheduleCorrection } from '@/features/schedules/assignments/actions';
import { generateAutoSchedule } from '@/features/schedules/generation/actions';
import { publishSchedule } from '@/features/schedules/draft-schedule/actions';
import { getUpcomingSchedule } from '@/features/schedules/assignments/queries';
import { loadSchedulingInput } from '@/features/schedules/generation/queries';
import { submitAvailability } from '@/features/availability/actions';

const date = (day: string) => new Date(`${day}T00:00:00Z`);
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('scheduling services against migrated PostgreSQL', () => {
  let facilityId: string;
  let scheduleId: string;
  let periodId: string;
  let positionId: string;
  let employeeId: string;
  let managerId: string;
  let expected: { versionId: string | null; revision: number };
  beforeEach(async () => {
    const suffix = randomUUID();
    const region = await prisma.district.create({ data: { name: 'test', code: suffix } });
    const court = await prisma.facility.create({ data: { name: 'test', code: suffix, districtId: region.id } });
    facilityId = court.id;
    const position = await prisma.shiftRole.create({ data: { facilityId, name: 'renamable label', rank: 4 } });
    positionId = position.id;
    const employee = await prisma.user.create({ data: { email: `${suffix}-emp@test.invalid`, passwordHash: 'unused', facilityId, shiftRoleId: positionId, firstName: 'Test', lastName: 'Employee', displayName: 'Test Employee' } });
    employeeId = employee.id;
    const manager = await prisma.user.create({ data: { email: `${suffix}@test.invalid`, passwordHash: 'unused', systemRole: 'USER', firstName: 'Test', lastName: 'Manager', displayName: 'Test Manager', facilityId, shiftRoleId: positionId, facilityRoles: { create: { facilityId, role: 'MANAGER' } } } });
    managerId = identity.userId = manager.id;
    const period = await prisma.schedulePeriod.create({ data: { facilityId, name: 'test', startDate: date('2098-01-06'), endDate: date('2098-01-19'), submissionOpensAt: new Date('2020-01-01'), submissionDeadline: date('2098-01-05'), submissionState: 'OPEN' } });
    periodId = period.id;
    const schedule = await prisma.roster.create({ data: { facilityId, periodId, createdById: manager.id } });
    scheduleId = schedule.id;
    for (const dayCategory of ['WEEKDAY','FRIDAY','SATURDAY'] as const) {
      for (const shiftType of ['MORNING','EVENING','NIGHT'] as const) {
        await prisma.staffingRequirement.create({ data: { facilityId, shiftRoleId: positionId, dayCategory, shiftType, requiredCount: 1 } });
      }
    }
    await prisma.availabilitySubmission.create({ data: { employeeId, periodId, isSubmitted: true, shiftAvailabilities: { create: [{ date: date('2098-01-06'), shiftType: 'MORNING', preference: 'PREFERRED' }, { date: date('2098-01-07'), shiftType: 'NIGHT' }] } } });
    expected = await startScheduleCorrection(scheduleId, { versionId: null, revision: 0 });
  });
  afterAll(async () => { await prisma?.$disconnect(); });
  const add = async (token = expected) => createAssignment({ scheduleId, employeeId, positionId, date: '2098-01-06', shiftType: 'MORNING', slotIndex: 0 }, token);
  const publish = async () => {
    const result = await publishSchedule(scheduleId, { ...expected, reason: 'test publication', confirmIssues: true });
    expect(result).toEqual({ ok: true });
    const version = await prisma.rosterVersion.findUniqueOrThrow({ where: { id: expected.versionId! } });
    expected = { versionId: version.id, revision: version.revision };
  };

  it('keeps published assignments visible until a correction is published and counts history once', async () => {
    await add(); expected.revision++;
    await publish();
    const original = await prisma.shiftAssignment.findFirstOrThrow({ where: { versionId: expected.versionId! } });
    const oldId = expected.versionId!;
    expected = await startScheduleCorrection(scheduleId, expected);
    expect(expected.versionId).not.toBe(oldId);
    const copy = await prisma.shiftAssignment.findFirstOrThrow({ where: { versionId: expected.versionId! } });
    expect(copy.employeeId).toBe(original.employeeId);
    await createAssignment({ scheduleId, employeeId, positionId, date: '2098-01-07', shiftType: 'NIGHT', slotIndex: 0 }, expected);
    expected.revision++;
    const visible = await getUpcomingSchedule(facilityId);
    expect(Object.values(visible!.assignments).flat()).toHaveLength(1);
    expect(await prisma.rosterVersion.count({ where: { scheduleId, isActive: true, id: oldId } })).toBe(1);
    await publish();
    expect(await prisma.shiftAssignment.count({ where: { scheduleId } })).toBe(3);
    expect(await prisma.shiftAssignment.count({ where: { scheduleId, version: { isActive: true } } })).toBe(2);
    const future = await prisma.schedulePeriod.create({ data: { facilityId, name: 'future', startDate: date('2098-01-20'), endDate: date('2098-02-02'), submissionOpensAt: date('2098-01-01'), submissionDeadline: date('2098-01-19') } });
    const next = await prisma.roster.create({ data: { facilityId, periodId: future.id, createdById: managerId } });
    const input = await loadSchedulingInput(prisma, next.id, facilityId, null);
    expect(input.input.historicalAssignments).toHaveLength(2);
  });

  it('rejects unavailable and unsubmitted availability for manual changes', async () => {
    await expect(createAssignment({ scheduleId, employeeId, positionId, date: '2098-01-06', shiftType: 'NIGHT', slotIndex: 0 }, expected)).rejects.toThrow('זמינות');
    await prisma.availabilitySubmission.update({ where: { periodId_employeeId: { periodId, employeeId } }, data: { isSubmitted: false } });
    await expect(add()).rejects.toThrow('זמינות');
    expect(await prisma.shiftAssignment.count({ where: { scheduleId } })).toBe(0);
  });

  it('rejects assigning an employee to a slot above their rank', async () => {
    const higherRolePosition = await prisma.shiftRole.create({ data: { facilityId, name: 'higher rank role', rank: 1 } });
    await prisma.staffingRequirement.create({ data: { facilityId, shiftRoleId: higherRolePosition.id, dayCategory: 'WEEKDAY', shiftType: 'MORNING', requiredCount: 1 } });
    await expect(createAssignment({ scheduleId, employeeId, positionId: higherRolePosition.id, date: '2098-01-06', shiftType: 'MORNING', slotIndex: 0 }, expected)).rejects.toThrow('תקינים');
  });

  it('rejects stale edits and serializes concurrent writers', async () => {
    const result = await Promise.allSettled([add(), add()]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.shiftAssignment.count({ where: { scheduleId } })).toBe(1);
    await expect(add()).rejects.toThrow('לרענן');
  });

  it('allows exactly one concurrent publication', async () => {
    await add(); expected.revision++;
    const options = { ...expected, reason: 'publish', confirmIssues: true };
    const results = await Promise.all([publishSchedule(scheduleId, options), publishSchedule(scheduleId, options)]);
    expect(results.filter(r => 'ok' in r)).toHaveLength(1);
    expect(await prisma.rosterVersion.count({ where: { scheduleId, isActive: true } })).toBe(1);
  });

  it('protects old assignments, version metadata, audit and target-version moves at database level', async () => {
    await add(); expected.revision++;
    await publish();
    const publishedId = expected.versionId!;
    const assignment = await prisma.shiftAssignment.findFirstOrThrow({ where: { versionId: publishedId } });
    await expect(prisma.shiftAssignment.update({ where: { id: assignment.id }, data: { isLocked: true } })).rejects.toThrow('immutable');
    await expect(prisma.rosterVersion.update({ where: { id: publishedId }, data: { status: 'DRAFT', publishedAt: null } })).rejects.toThrow('immutable');
    await expect(prisma.rosterVersion.delete({ where: { id: publishedId } })).rejects.toThrow();
    await expect(prisma.scheduleChangeLog.deleteMany({ where: { scheduleId } })).rejects.toThrow('append-only');
    expected = await startScheduleCorrection(scheduleId, expected);
    const copy = await prisma.shiftAssignment.findFirstOrThrow({ where: { versionId: expected.versionId! } });
    await expect(prisma.shiftAssignment.update({ where: { id: copy.id }, data: { versionId: publishedId } })).rejects.toThrow('immutable');
  });

  it('rejects inconsistent assignment/version/schedule references', async () => {
    const p = await prisma.schedulePeriod.create({ data: { facilityId, name: 'different', startDate: date('2098-02-03'), endDate: date('2098-02-16'), submissionDeadline: date('2098-02-02') } });
    const other = await prisma.roster.create({ data: { facilityId, periodId: p.id, createdById: managerId } });
    await expect(prisma.shiftAssignment.create({ data: { facilityId, scheduleId: other.id, versionId: expected.versionId!, employeeId, shiftRoleId: positionId, date: date('2098-01-06'), shiftType: 'MORNING' } })).rejects.toThrow();
  });

  it('uses current membership, so a revoked manager cannot mutate', async () => {
    await prisma.userFacilityRole.delete({ where: { userId_facilityId: { userId: managerId, facilityId } } });
    await expect(requireManager()).rejects.toThrow('UNAUTHORIZED');
    await expect(add()).rejects.toThrow('UNAUTHORIZED');
  });

  it('does not allow a different court manager to edit the schedule', async () => {
    const region = await prisma.district.findFirstOrThrow({ where: { facilities: { some: { id: facilityId } } } });
    const other = await prisma.facility.create({ data: { name: 'other', code: randomUUID(), districtId: region.id } });
    const otherRole = await prisma.shiftRole.create({ data: { facilityId: other.id, name: 'other role', rank: 1 } });
    const manager = await prisma.user.create({ data: { email: `${randomUUID()}@test.invalid`, passwordHash: 'x', systemRole: 'USER', firstName: 'Other', lastName: 'Manager', displayName: 'Other Manager', facilityId: other.id, shiftRoleId: otherRole.id, facilityRoles: { create: { facilityId: other.id, role: 'MANAGER' } } } });
    identity.userId = manager.id;
    await expect(add()).rejects.toThrow();
  });

  it('scopes employee submissions to the authenticated employee and enforces deadline without cron', async () => {
    identity.userId = employeeId;
    const result = await submitAvailability({ periodId, entries: { '2098-01-06-MORNING': 'PREFERRED', '2098-01-07-NIGHT': 'UNAVAILABLE' } });
    expect(result.ok).toBe(true);
    const input = await loadSchedulingInput(prisma, scheduleId, facilityId, expected.versionId);
    expect(input.input.preferences?.get(employeeId)?.has('2098-01-06|MORNING')).toBe(true);
    expect(input.input.availability.get(employeeId)?.has('2098-01-07|NIGHT')).toBe(false);
    await prisma.schedulePeriod.update({ where: { id: periodId }, data: { submissionDeadline: new Date('2021-01-01') } });
    expect((await submitAvailability({ periodId, entries: {} })).ok).toBe(false);
  });

  it('regeneration retains only explicit locks and removes replaceable manual assignments', async () => {
    await add(); expected.revision++;
    const row = await prisma.shiftAssignment.findFirstOrThrow({ where: { scheduleId } });
    await prisma.shiftAssignment.update({ where: { id: row.id }, data: { isLocked: true } });
    const result = await generateAutoSchedule(scheduleId, expected);
    expect('ok' in result).toBe(true);
    expect(await prisma.shiftAssignment.findUnique({ where: { id: row.id } })).not.toBeNull();
    expect(await prisma.shiftAssignment.count({ where: { scheduleId, source: 'AUTOMATIC' } })).toBeGreaterThan(0);
  });

  it('checks rest against the previous published period', async () => {
    const previousPeriod = await prisma.schedulePeriod.create({ data: { facilityId, name: 'previous', startDate: date('2097-12-23'), endDate: date('2098-01-05'), submissionDeadline: date('2097-12-22') } });
    const previous = await prisma.roster.create({ data: { facilityId, periodId: previousPeriod.id, createdById: managerId } });
    const v = await prisma.rosterVersion.create({ data: { facilityId, scheduleId: previous.id, createdById: managerId, version: 1 } });
    await prisma.shiftAssignment.create({ data: { facilityId, scheduleId: previous.id, versionId: v.id, employeeId, shiftRoleId: positionId, date: date('2098-01-05'), shiftType: 'NIGHT' } });
    await prisma.rosterVersion.update({ where: { id: v.id }, data: { status: 'PUBLISHED', publishedAt: new Date(), isActive: true } });
    await expect(add()).rejects.toThrow('מנוחה');
  });
});
