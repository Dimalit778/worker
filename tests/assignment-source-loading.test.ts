import { expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/db/auth-helpers', () => ({ requireManager: vi.fn() }));
import { loadSchedulingInput } from '@/features/schedules/generation/queries';
import { createTimeOffWarnings } from '@/features/scheduling-engine/warnings';

it('carries the persisted manual source through loading so edits remain valid after refresh and at publication', async () => {
  const date = new Date('2026-10-05T00:00:00Z');
  const slot = { id: 'slot', userId: 'employee', facilityId: 'facility', positionId: 'position', date, shiftType: 'MORNING', slotNumber: 1, isLocked: false, source: 'MANUAL' };
  const tx = {
    schedule: { findFirst: vi.fn().mockResolvedValue({ id: 'schedule', startDate: date, endDate: date }) },
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
    schedule: { findFirst: vi.fn().mockResolvedValue({ id: 'schedule', startDate: day1, endDate: day2 }) },
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
