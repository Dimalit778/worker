import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

// Period date uniqueness against a migrated PostgreSQL (same conventions as scheduling-postgres.test.ts).
vi.mock('@/lib/db/client', async () => {
  if (!process.env.TEST_DATABASE_URL) return { prisma: null };
  const target = new URL(process.env.TEST_DATABASE_URL);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Integration tests require a localhost database ending in _test');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = await import('@/generated/prisma/client');
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) }) };
});
import { prisma } from '@/lib/db/client';

const date = (day: string) => new Date(`${day}T00:00:00Z`);
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('schedule period dates against migrated PostgreSQL', () => {
  let facilityId: string;
  const createPeriod = (facility = facilityId) => prisma.schedule.create({ data: { facilityId: facility, name: 'test', startDate: date('2098-02-03'), endDate: date('2098-02-09'), submissionOpensAt: new Date('2020-01-01'), submissionClosesAt: date('2098-02-02') } });

  beforeEach(async () => {
    const suffix = randomUUID();
    const district = await prisma.district.create({ data: { name: 'test', code: suffix } });
    facilityId = (await prisma.facility.create({ data: { name: 'test', code: suffix, districtId: district.id } })).id;
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('allows a new period with the dates of archived periods', async () => {
    const first = await createPeriod();
    await prisma.schedule.update({ where: { id: first.id }, data: { status: 'ARCHIVED' } });
    const second = await createPeriod();
    await prisma.schedule.update({ where: { id: second.id }, data: { status: 'ARCHIVED' } });
    const third = await createPeriod();
    expect(third.status).toBe('DRAFT');
  });

  it('rejects two non-archived periods with the same facility and dates', async () => {
    await createPeriod();
    await expect(createPeriod()).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same dates in another facility', async () => {
    await createPeriod();
    const district = await prisma.district.create({ data: { name: 'test', code: randomUUID() } });
    const other = await prisma.facility.create({ data: { name: 'test', code: randomUUID(), districtId: district.id } });
    await expect(createPeriod(other.id)).resolves.toMatchObject({ facilityId: other.id });
  });
});
