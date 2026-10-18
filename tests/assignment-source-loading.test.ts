import { expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/db/auth-helpers', () => ({ requireManager: vi.fn() }));
import { loadSchedulingInput } from '@/features/schedules/generation/queries';

it('carries the persisted manual source through loading so edits remain valid after refresh and at publication', async () => {
  const date = new Date('2026-10-05T00:00:00Z');
  const slot = { id: 'slot', userId: 'employee', facilityId: 'facility', positionId: 'position', date, shiftType: 'MORNING', slotNumber: 1, isLocked: false, source: 'MANUAL' };
  const tx = {
    schedule: { findFirst: vi.fn().mockResolvedValue({ id: 'schedule', startDate: date, endDate: date }) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    staffingRequirement: { findMany: vi.fn().mockResolvedValue([]) },
    staffingDateOverride: { findMany: vi.fn().mockResolvedValue([]) },
    availabilitySubmission: { findMany: vi.fn().mockResolvedValue([]) },
    scheduleSlot: { findMany: vi.fn().mockResolvedValueOnce([slot]).mockResolvedValueOnce([]) },
  };
  const data = await loadSchedulingInput(tx as unknown as Prisma.TransactionClient, 'schedule', 'facility', 'schedule');
  expect(data.allAssignments).toEqual([expect.objectContaining({ employeeId: 'employee', source: 'MANUAL', isManualOverride: false })]);
  expect(data.input.availability.size).toBe(0);
});
