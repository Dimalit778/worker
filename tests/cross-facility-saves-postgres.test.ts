import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

// Each concurrent save runs as its own manager, so the session user comes from async context.
const managers = vi.hoisted(() => ({ current: () => '' }));
vi.mock('next-auth', () => ({ getServerSession: async () => ({ user: { id: managers.current() }, expires: '2099-01-01' }) }));
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
import { saveScheduleChanges, startScheduleCorrection } from '@/features/schedules/assignments/actions';

const session = new AsyncLocalStorage<string>();
managers.current = () => session.getStore() ?? '';
const date = (day: string) => new Date(`${day}T00:00:00Z`);
const days = ['2098-01-06', '2098-01-07', '2098-01-08', '2098-01-09'];
type Facility = { managerId: string; employeeId: string; positionId: string; scheduleId: string; expected: { versionId: string | null; revision: number } };

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('schedule saves in different facilities against migrated PostgreSQL', () => {
  let facilities: Facility[];

  const createFacility = async (): Promise<Facility> => {
    const suffix = randomUUID();
    const district = await prisma.district.create({ data: { name: 'test', code: suffix } });
    const { id: facilityId } = await prisma.facility.create({ data: { name: 'test', code: suffix, districtId: district.id } });
    const role = await prisma.role.upsert({ where: { rank: 4 }, update: {}, create: { code: 'GUARD', name: 'guard', rank: 4 } });
    const { id: positionId } = await prisma.position.create({ data: { facilityId, name: 'guard', requiredRank: 4, displayOrder: 4 } });
    const user = (tag: string, extra = {}) => prisma.user.create({ data: { email: `${suffix}-${tag}@test.invalid`, passwordHash: 'unused', facilityId, roleId: role.id, firstName: 'Test', lastName: tag, displayName: `Test ${tag}`, ...extra } });
    const managerId = (await user('manager', { canEditSchedule: true })).id;
    const employeeId = (await user('employee')).id;
    for (const dayCategory of ['WEEKDAY', 'FRIDAY', 'SATURDAY'] as const) {
      for (const shiftType of ['MORNING', 'EVENING', 'NIGHT'] as const) {
        await prisma.staffingRequirement.create({ data: { facilityId, positionId, dayCategory, shiftType, requiredCount: 1 } });
      }
    }
    const schedule = await prisma.schedule.create({ data: { facilityId, name: 'test', startDate: date('2098-01-06'), endDate: date('2098-01-19'), submissionOpensAt: new Date('2020-01-01'), submissionClosesAt: date('2098-01-05') } });
    await prisma.availabilitySubmission.create({ data: { userId: employeeId, facilityId, scheduleId: schedule.id, submittedAt: new Date(), availabilities: { create: days.map(day => ({ date: date(day), shiftType: 'MORNING' as const, preference: 'AVAILABLE' as const })) } } });
    const expected = await session.run(managerId, () => startScheduleCorrection(schedule.id, { versionId: null, revision: 0 }));
    return { managerId, employeeId, positionId, scheduleId: schedule.id, expected };
  };

  beforeEach(async () => {
    facilities = [await createFacility(), await createFacility()];
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('saves both when managers of different facilities save at the same moment', async () => {
    for (const day of days) {
      const results = await Promise.allSettled(facilities.map(f => session.run(f.managerId, () =>
        saveScheduleChanges(f.scheduleId, f.expected, [{ date: day, shiftType: 'MORNING', positionId: f.positionId, slotIndex: 0, employeeId: f.employeeId }]))));
      expect(results.map(r => r.status === 'rejected' ? String(r.reason?.message) : 'saved')).toEqual(['saved', 'saved']);
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') facilities[i].expected = { versionId: r.value.versionId, revision: r.value.revision };
      });
    }
    for (const f of facilities) expect(await prisma.scheduleSlot.count({ where: { scheduleId: f.scheduleId, userId: f.employeeId } })).toBe(days.length);
  });
});
