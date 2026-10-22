import { expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/db/auth-helpers', () => ({ requireManager: vi.fn() }));
import { loadSchedulingInput } from '@/features/schedules/generation/queries';
import { createTimeOffWarnings } from '@/features/scheduling-engine/warnings';
import { shiftBounds } from '@/features/schedules/shift-times';

it('carries the persisted manual source through loading so edits remain valid after refresh and at publication', async () => {
  const date = new Date('2026-10-05T00:00:00Z');
  const slot = { id: 'slot', userId: 'employee', facilityId: 'facility', positionId: 'position', date, shiftType: 'MORNING', slotNumber: 1, isLocked: false, source: 'MANUAL' };
  const tx = {
    schedule: { findFirst: vi.fn().mockResolvedValue({ id: 'schedule', startDate: date, endDate: date }), findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    staffingRequirement: { findMany: vi.fn().mockResolvedValue([]) },
    staffingDateOverride: { findMany: vi.fn().mockResolvedValue([]) },
    employeeRequest: { findMany: vi.fn().mockResolvedValue([]) },
    availabilitySubmission: { findMany: vi.fn().mockResolvedValue([]) },
    scheduleSlot: { findMany: vi.fn().mockResolvedValueOnce([slot]).mockResolvedValueOnce([]) },
  };
  const data = await loadSchedulingInput(tx as unknown as Prisma.TransactionClient, 'schedule', 'facility', 'schedule');
  expect(data.allAssignments).toEqual([expect.objectContaining({ employeeId: 'employee', source: 'MANUAL', isManualOverride: false })]);
  expect(data.input.availability.size).toBe(0);
});

it('treats approved time-off days as unavailable and flags existing assignments on them', async () => {
  const day1 = new Date('2026-10-05T00:00:00Z');
  const day2 = new Date('2026-10-06T00:00:00Z');
  const slot = { id: 'slot', userId: 'employee', facilityId: 'facility', positionId: 'position', date: day1, shiftType: 'MORNING', slotNumber: 1, isLocked: false, source: 'AUTO' };
  const tx = {
    schedule: { findFirst: vi.fn().mockResolvedValue({ id: 'schedule', startDate: day1, endDate: day2 }), findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    staffingRequirement: { findMany: vi.fn().mockResolvedValue([]) },
    staffingDateOverride: { findMany: vi.fn().mockResolvedValue([]) },
    employeeRequest: { findMany: vi.fn().mockResolvedValue([{ requesterId: 'employee', startDate: day1, endDate: day1 }]) },
    availabilitySubmission: { findMany: vi.fn().mockResolvedValue([{ userId: 'employee', availabilities: [
      { date: day1, shiftType: 'MORNING', preference: 'PREFERRED' },
      { date: day2, shiftType: 'MORNING', preference: 'AVAILABLE' },
    ] }]) },
    scheduleSlot: { findMany: vi.fn().mockResolvedValueOnce([slot]).mockResolvedValueOnce([]) },
  };
  const data = await loadSchedulingInput(tx as unknown as Prisma.TransactionClient, 'schedule', 'facility', 'schedule');
  expect(tx.employeeRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ type: 'TIME_OFF', status: 'APPROVED' }) }));
  expect([...data.input.availability.get('employee')!]).toEqual(['2026-10-06|MORNING']);
  expect(data.input.preferences.get('employee')!.size).toBe(0);
  const warnings = createTimeOffWarnings(data.allAssignments, data.input.timeOff);
  expect(warnings).toEqual([expect.objectContaining({ type: 'CONFLICT', severity: 'ERROR', employeeId: 'employee', message: expect.stringContaining('חופשה מאושרת') })]);
});

it('marks the later slot of one custom-hours shift as an extension', async () => {
  const date = new Date('2026-10-05T00:00:00Z');
  const base = { userId: 'employee', facilityId: 'facility', positionId: 'position', versionId: 'v', date, slotNumber: 1, isLocked: true, source: 'MANUAL', ...shiftBounds(date, '07:00', '19:00') };
  const slots = [{ ...base, id: 'evening', shiftType: 'EVENING' }, { ...base, id: 'morning', shiftType: 'MORNING' }];
  const tx = {
    schedule: { findFirst: vi.fn().mockResolvedValue({ id: 'schedule', startDate: date, endDate: date }), findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    staffingRequirement: { findMany: vi.fn().mockResolvedValue([]) },
    staffingDateOverride: { findMany: vi.fn().mockResolvedValue([]) },
    employeeRequest: { findMany: vi.fn().mockResolvedValue([]) },
    availabilitySubmission: { findMany: vi.fn().mockResolvedValue([]) },
    scheduleSlot: { findMany: vi.fn().mockResolvedValueOnce(slots).mockResolvedValueOnce([]) },
  };
  const data = await loadSchedulingInput(tx as unknown as Prisma.TransactionClient, 'schedule', 'facility', 'v');
  const byShift = Object.fromEntries(data.allAssignments.map(a => [a.shiftType, a]));
  expect(byShift.MORNING.isExtension).toBeUndefined();
  expect(byShift.EVENING.isExtension).toBe(true);
  expect(byShift.EVENING.customHours).toBe(byShift.MORNING.customHours);
});

it('reads surrounding slots only from the current versions of other schedules', async () => {
  const date = new Date('2026-10-05T00:00:00Z');
  const neighbour = { id: 'neighbour', userId: 'employee', facilityId: 'facility', positionId: 'position', versionId: 'published-version', date: new Date('2026-10-04T00:00:00Z'), shiftType: 'EVENING', slotNumber: 1, isLocked: false, source: 'AUTO' };
  const tx = {
    schedule: { findFirst: vi.fn().mockResolvedValue({ id: 'schedule', startDate: date, endDate: date }), findMany: vi.fn().mockResolvedValue([{ status: 'PUBLISHED', publishedVersionId: 'published-version', draftVersionId: null }]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    staffingRequirement: { findMany: vi.fn().mockResolvedValue([]) },
    staffingDateOverride: { findMany: vi.fn().mockResolvedValue([]) },
    employeeRequest: { findMany: vi.fn().mockResolvedValue([]) },
    availabilitySubmission: { findMany: vi.fn().mockResolvedValue([]) },
    scheduleSlot: { findMany: vi.fn().mockResolvedValue([neighbour]) },
  };
  const data = await loadSchedulingInput(tx as unknown as Prisma.TransactionClient, 'schedule', 'facility', null);
  expect(tx.schedule.findMany).toHaveBeenCalledWith({
    where: { facilityId: 'facility', id: { not: 'schedule' }, OR: [
      { status: 'PUBLISHED', publishedVersionId: { not: null } },
      { status: 'DRAFT', draftVersionId: { not: null } },
    ] },
    select: { status: true, publishedVersionId: true, draftVersionId: true },
  });
  expect(tx.scheduleSlot.findMany).toHaveBeenCalledTimes(1);
  expect(tx.scheduleSlot.findMany).toHaveBeenCalledWith({
    where: {
      facilityId: 'facility',
      versionId: { in: ['published-version'] },
      userId: { not: null },
      date: { gte: new Date('2026-08-10T00:00:00Z'), lte: new Date('2026-10-06T00:00:00Z') },
    },
  });
  expect(data.input.historicalAssignments).toEqual([expect.objectContaining({ employeeId: 'employee' })]);
});

it('skips the surrounding slots query when no other schedule is published', async () => {
  const date = new Date('2026-10-05T00:00:00Z');
  const tx = {
    schedule: { findFirst: vi.fn().mockResolvedValue({ id: 'schedule', startDate: date, endDate: date }), findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    staffingRequirement: { findMany: vi.fn().mockResolvedValue([]) },
    staffingDateOverride: { findMany: vi.fn().mockResolvedValue([]) },
    employeeRequest: { findMany: vi.fn().mockResolvedValue([]) },
    availabilitySubmission: { findMany: vi.fn().mockResolvedValue([]) },
    scheduleSlot: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const data = await loadSchedulingInput(tx as unknown as Prisma.TransactionClient, 'schedule', 'facility', null);
  expect(tx.scheduleSlot.findMany).not.toHaveBeenCalled();
  expect(data.input.historicalAssignments).toEqual([]);
  expect(data.input.boundaryAssignments).toEqual([]);
});

it('checks conflicts against a neighbouring draft too, without counting it as history', async () => {
  const start = new Date('2026-10-05T00:00:00Z');
  const end = new Date('2026-10-11T00:00:00Z');
  const row = (id: string, versionId: string, date: string, shiftType: string) => ({ id, userId: id, facilityId: 'facility', positionId: 'position', versionId, date: new Date(`${date}T00:00:00Z`), shiftType, slotNumber: 1, isLocked: false, source: 'MANUAL' });
  const rows: Record<string, ReturnType<typeof row>[]> = {
    'published-version': [row('before', 'published-version', '2026-10-04', 'NIGHT')],
    'draft-version': [row('after', 'draft-version', '2026-10-12', 'MORNING')],
  };
  const tx = {
    schedule: { findFirst: vi.fn().mockResolvedValue({ id: 'schedule', startDate: start, endDate: end }), findMany: vi.fn().mockResolvedValue([
      { status: 'PUBLISHED', publishedVersionId: 'published-version', draftVersionId: null },
      { status: 'DRAFT', publishedVersionId: null, draftVersionId: 'draft-version' },
    ]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    staffingRequirement: { findMany: vi.fn().mockResolvedValue([]) },
    staffingDateOverride: { findMany: vi.fn().mockResolvedValue([]) },
    employeeRequest: { findMany: vi.fn().mockResolvedValue([]) },
    availabilitySubmission: { findMany: vi.fn().mockResolvedValue([]) },
    scheduleSlot: { findMany: vi.fn(async ({ where }: { where: { versionId: { in: string[] } } }) => where.versionId.in.flatMap(id => rows[id] ?? [])) },
  };
  const data = await loadSchedulingInput(tx as unknown as Prisma.TransactionClient, 'schedule', 'facility', null);
  // A draft is not history: only its days next to this schedule are read.
  expect(tx.scheduleSlot.findMany).toHaveBeenCalledWith({ where: expect.objectContaining({
    versionId: { in: ['draft-version'] }, date: { gte: new Date('2026-10-04T00:00:00Z'), lte: new Date('2026-10-12T00:00:00Z') },
  }) });
  expect(data.input.boundaryAssignments?.map(a => a.employeeId).sort()).toEqual(['after', 'before']);
  expect(data.input.historicalAssignments?.map(a => a.employeeId)).toEqual(['before']);
});
